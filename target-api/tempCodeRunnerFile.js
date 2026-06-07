import express from 'express';

const app = express();
const PORT = 6969;

app.get('/', (req, res) => {
    console.log(`[SERVER] Redirecting client to: https://picsum.photos/id/1024/800/600`);
    res.redirect('https://wallhaven.cc/api/v1/search?sorting=date_added&order=desc&categories=010&purity=100&page=1&apikey=jvlElNDcAQb4IbAL2S6JvkGDtMbgGRD2');
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});