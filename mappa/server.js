import 'dotenv/config'; 
import express from 'express';
const app = express();
const port = 3000;

// Configura Express per leggere i file statici da una cartella chiamata "public" (html)
app.use(express.static('public'));

// Rotta per inviare la chiave API al frontend
app.get('/api-config', (req, res) => {
  res.json({ apiKey: process.env.GOOGLE_MAPS_API_KEY });
});

app.listen(port, () => {
  console.log(`\n Server pronto! Apri il browser su: http://localhost:${port}`);
});
