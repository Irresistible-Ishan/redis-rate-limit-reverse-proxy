// as mentioned in readme i need to build it with some reference backend so this is it
// i m choosing js for it because it has single threading based handling in general 
// so using my reverse proxy we will try to protect it
// from being overwhelmed 

const http = require('http');

const server = http.createServer((req, res) => {
    console.log(`[Backend Received] ${req.method} ${req.url}`);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status: "success",
        message: "Hello from the upstream backend service lol!",
        receivedPath: req.url,
        receivedHeaders: req.headers
    }, null, 2));
});

const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Mock Upstream Backend running on http://localhost:${PORT}`);
});