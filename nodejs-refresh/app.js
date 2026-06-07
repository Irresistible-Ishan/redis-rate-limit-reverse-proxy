import express from 'express';

const app = express();
const PORT = 6969;

app.get('/image/random', (req, res) => {
    console.log(`[SERVER] Redirecting client to: https://picsum.photos/id/1024/800/600`);
    res.redirect('https://picsum.photos/id/1024/800/600');
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/image/random`);
});