import express from 'express';

const app = express();
const PORT = 6969;

app.get('/', async (req, res) => {
    const response = await fetch('https://wallhaven.cc/api/v1/search?sorting=toplist&order=desc&categories=100&purity=100&page=1&apikey=jvlElNDcAQb4IbAL2S6JvkGDtMbgGRD2');
    const jsonData = await response.json();
    const imagePath = jsonData.data[0].path;
    res.redirect(imagePath);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});