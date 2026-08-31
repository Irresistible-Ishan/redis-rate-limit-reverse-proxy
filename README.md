Redis Lua Token Bucket + IP Spoofing patch

for developnment of this project im not taking any website as the reference and im going for a local site protection based on port 5000

api-gateway/
├── cmd/
│   └── gateway/
│       └── main.go             # Entrypoint: initializes Redis, builds pipeline, starts server
├── internal/
│   ├── config/
│   │   └── config.go           # Ports, upstream URLs, rate-limit thresholds
│   ├── identity/
│   │   └── client_ip.go        # TCP-level origin IP extraction (anti-spoofing)
│   ├── limiter/
│   │   ├── limiter.go          # Go wrapper invoking Redis via go-redis/v9
│   │   └── token_bucket.lua    # Raw Lua script executed atomically inside Redis
│   ├── middleware/
│   │   └── ratelimit.go        # HTTP middleware chaining identity -> limiter -> proxy
│   └── proxy/
│       └── proxy.go            # httputil.ReverseProxy implementation to forward clean traffic
├── mock-backend/
│   └── main.go                 # Dummy upstream server to verify request forwarding
├── test-scripts/
│   ├── race_test.go            # Concurrent bombarding test
│   └── spoof_test.go           # Header spoofing test
├── go.mod
└── go.sum


[ Incoming HTTP Request ]
          │
          ▼
1. Go HTTP Listener (net/http on port :8080)
   Spawns a lightweight Goroutine (~2KB memory).
          │
          ▼
2. Identity Layer (`internal/identity/client_ip.go`)
   Extracts IP directly from `r.RemoteAddr` (TCP socket).
   Rejects untrusted `X-Forwarded-For` injection.
          │
          ▼
3. Rate Limit Middleware (`internal/middleware/ratelimit.go`)
   Calls `limiter.Allow(ctx, clientIP)`.
          │
          ▼
4. Distributed Limiter (`internal/limiter/limiter.go`)
   Uses `go-redis/v9` to issue `EVALSHA` / `EVAL` to Redis.
          │
          ▼
5. In-Memory Redis Engine (Running `token_bucket.lua`)
   - Reads bucket balance for this IP key.
   - Computes token replenishment based on timestamp delta.
   - Decrements token if available.
   - Returns [1 = Allowed, 0 = Rejected] in a single atomic cycle.
          │
          ├───────────────────────────────┐
          │ (If 0 / Denied)               │ (If 1 / Allowed)
          ▼                               ▼
   HTTP 429 Too Many Requests     6. Reverse Proxy Layer (`internal/proxy/proxy.go`)
   Connection drops immediately.     Uses `httputil.NewSingleHostReverseProxy()`.
   (Backend is untouched).           Rewrites headers & forwards request.
                                          │
                                          ▼
                                  7. Upstream Backend (Port :5000)
                                     Receives validated traffic, returns 200 OK.



 Edge-Optimized API Gateway & Distributed Rate Limiter

1. Architectural Overview
This project is a high-performance Layer 7 Reverse Proxy and API Gateway built using Node.js and Redis. It acts as a defensive middleware shield sitting between the public internet and backend microservices.

Instead of allowing direct client-to-server communication, all incoming HTTP traffic is intercepted at the edge. The gateway evaluates the traffic using a distributed in-memory rate-limiting algorithm before securely forwarding clean requests to the upstream application servers.

2. Core Technical Capabilities
Token Bucket Algorithm: Implements a highly efficient token bucket system (or sliding window), allowing for controlled bursts of legitimate API traffic while strictly capping sustained abuse over time.

Atomic Distributed State (Redis Lua): Utilizes custom Redis Lua scripts to manage rate-limit counters. Because Redis executes Lua scripts on a single thread, the entire "read-evaluate-write" sequence runs as one atomic operation, making it mathematically impossible for concurrent requests to read stale data.

Zero-Overhead Proxying: Uses http-proxy to stream requests directly to upstream microservices without buffering large payloads in memory, ensuring microsecond latency overhead at the gateway level.

3. Vulnerabilities & Attack Vectors Mitigated
This system is specifically engineered to patch two critical infrastructure flaws commonly found in standard, beginner-level limiters:

A. Concurrent Race Condition Attacks
The Threat: Hackers send 100 requests in the exact same millisecond. Traditional Node.js limiters read the database counter as 0 for all 100 requests simultaneously, allowing the entire burst to bypass the limit before the database updates to 1.

The Fix: By pushing the Token Bucket logic down into a Redis Lua script, the execution is locked. Even under extreme concurrency, the Redis engine forces all 100 requests into a single-file line, accurately processing the limit without dropping a single count.

B. Header Injection (IP Spoofing)
The Threat: Attackers randomize the X-Forwarded-For HTTP header on every request to trick the server into thinking the attack is coming from thousands of different users, bypassing the IP limit entirely.

The Fix: Implements Strict Proxy Validation. The gateway explicitly drops or ignores the X-Forwarded-For header unless the physical TCP connection originates from a trusted infrastructure IP (like a verified AWS Load Balancer or Cloudflare node).

C. Upstream Cascading Failures (DDoS Protection)
The Threat: A massive, sudden spike in traffic overwhelms the database connections on the main application server, causing a complete system outage.

The Fix: The Gateway acts as a Circuit Breaker. By rejecting excess traffic at the proxy level with an HTTP 429 Too Many Requests status, the main application server never even sees the spike, keeping CPU and memory usage stable under load.


1.Phase 1: Build the Vulnerable Target:The baseline.We will write a basic Node.js API with a "standard" (flawed) rate limiter. This is the exact code that 90% of tutorials teach you to write. It will read the IP from X-Forwarded-For blindly, and it will do the math inside Node.js instead of Redis.

2.Phase 2: Red Team (The Attack):Exploitation.We take off the engineer hat and put on the hacker hat. We will write two tiny attack scripts:Attack A (The Spoofer): A script that loops 100 times, injecting a fake X-Forwarded-For IP on every request to bypass the limit.Attack B (The Race Condition): A script that fires 50 concurrent requests at the exact same millisecond to prove the Node.js database read/write cycle is too slow to stop them.

3.Phase 3: Blue Team (The Gateway Bridge):Architecture shift.We strip the flawed rate limiter out of the target API. We create your new server.js file, set up http-proxy, and write the code that strictly drops fake X-Forwarded-For headers. Your target API is now hidden behind this Gateway.

4.Phase 4: The Lua Armor:Atomic execution.We write the Redis Lua script for the Token Bucket. We connect it to the Gateway so that Redis handles the math internally on a single thread.

5.Phase 5: The Final Onslaught:Verification.We run Attack A and Attack B again, but this time aimed at your new Gateway. You will watch the console light up with 429 Too Many Requests as the Gateway mathematically crushes the race condition and ignores the spoofed IPs.