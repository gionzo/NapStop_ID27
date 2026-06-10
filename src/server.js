import 'dotenv/config'; 
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const port = process.env.PORT || 3000;
app.listen(port, () => {
 console.log(`Server in esecuzione sulla porta ${port}`);
});

app.use(express.json());
app.use(express.static('public'));

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/napstop';
mongoose.connect(mongoUri)
  .then(() => console.log('Connesso con successo a MongoDB!'))
  .catch(err => console.error('Errore di connessione a MongoDB:', err));

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  fotoProfilo: { type: String, default: 'avatar1.png' }
});
const User = mongoose.model('User', userSchema);

const viaggioSchema = new mongoose.Schema({
  utenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  destinazione: { type: String, required: true },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  mezzo: { type: String, required: true },
  raggio: { type: String, required: true },
  notifica: { type: String, required: true },
  suoneria: { type: String, default: null },
  preferito: { type: Boolean, default: false },
  dataCreazione: { type: Date, default: Date.now }
});
const Viaggio = mongoose.model('Viaggio', viaggioSchema);

function autenticaToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ errore: 'Accesso negato. Token mancante.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ errore: 'Token non valido o scaduto.' });
    }
    req.userId = decoded.userId;
    next();
  });
}

app.post('/api/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ errore: 'Email e password sono obbligatorie.' });
    }

    const utenteEsistente = await User.findOne({ email });
    if (utenteEsistente) {
      return res.status(400).json({ errore: 'Questa email è già registrata.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordCriptata = await bcrypt.hash(password, salt);

    const nuovoUtente = new User({ email, password: passwordCriptata });
    await nuovoUtente.save();

    res.status(201).json({ messaggio: 'Registrazione completata con successo!' });
  } catch (error) {
    console.error('Errore Signup:', error);
    res.status(500).json({ errore: 'Errore nel server durante la registrazione.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ errore: 'Inserisci email e password.' });
    }

    const utente = await User.findOne({ email });
    if (!utente) {
      return res.status(400).json({ errore: 'Email o password errate.' });
    }

    const passwordValida = await bcrypt.compare(password, utente.password);
    if (!passwordValida) {
      return res.status(400).json({ errore: 'Email o password errate.' });
    }

    const token = jwt.sign({ userId: utente._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({ messaggio: 'Login effettuato con successo!', token });
  } catch (error) {
    console.error('Errore Login:', error);
    res.status(500).json({ errore: 'Errore nel server durante il login.' });
  }
});

app.get('/api/profilo', autenticaToken, async (req, res) => {
  try {
    const utente = await User.findById(req.userId);
    if (!utente) {
      return res.status(404).json({ errore: 'Utente non trovato.' });
    }
    res.json({ email: utente.email, fotoProfilo: utente.fotoProfilo });
  } catch (error) {
    console.error('Errore recupero profilo:', error);
    res.status(500).json({ errore: 'Impossibile recuperare il profilo.' });
  }
});

app.put('/api/profilo', autenticaToken, async (req, res) => {
  try {
    const { fotoProfilo } = req.body;
    if (!fotoProfilo) {
      return res.status(400).json({ errore: 'Foto non specificata.' });
    }

    const utenteAggiornato = await User.findByIdAndUpdate(
      req.userId,
      { fotoProfilo },
      { new: true }
    );

    res.json({ messaggio: 'Foto profilo aggiornata!', fotoProfilo: utenteAggiornato.fotoProfilo });
  } catch (error) {
    console.error('Errore aggiornamento foto profilo:', error);
    res.status(500).json({ errore: 'Impossibile aggiornare la foto profilo.' });
  }
});

app.post('/api/viaggi', autenticaToken, async (req, res) => {
  try {
    const { destinazione, lat, lng, mezzo, raggio, notifica, suoneria, preferito } = req.body;

    const nuovoViaggio = new Viaggio({
      utenteId: req.userId, 
      destinazione,
      lat: lat || null,
      lng: lng || null,
      mezzo,
      raggio,
      notifica,
      suoneria: suoneria || null,
      preferito: preferito || false
    });

    await nuovoViaggio.save();
    res.status(201).json({ messaggio: 'Viaggio salvato nel database con successo!', viaggio: nuovoViaggio });
  } catch (error) {
    console.error('Errore Salvataggio Viaggio:', error);
    res.status(500).json({ errore: 'Impossibile salvare il viaggio nel database.' });
  }
});

app.get('/api/viaggi', autenticaToken, async (req, res) => {
  try {
    const viaggi = await Viaggio.find({ utenteId: req.userId }).sort({ dataCreazione: -1 });
    res.json(viaggi);
  } catch (error) {
    console.error('Errore recupero cronologia:', error);
    res.status(500).json({ errore: 'Impossibile recuperare la cronologia dei viaggi.' });
  }
});

app.put('/api/viaggi/:id', autenticaToken, async (req, res) => {
  try {
    const viaggioId = req.params.id;
    const { preferito } = req.body;

    if (preferito === undefined) {
      return res.status(400).json({ errore: "Parametro 'preferito' mancante." });
    }

    const viaggioAggiornato = await Viaggio.findOneAndUpdate(
      { _id: viaggioId, utenteId: req.userId }, 
      { preferito: preferito },
      { new: true } 
    );

    if (!viaggioAggiornato) {
      return res.status(404).json({ errore: 'Viaggio non trovato o non autorizzato.' });
    }

    res.json({ messaggio: 'Stato preferito aggiornato con successo!', viaggio: viaggioAggiornato });
  } catch (error) {
    console.error('Errore durante l\'aggiornamento del preferito:', error);
    res.status(500).json({ errore: 'Errore interno del server durante la sincronizzazione.' });
  }
});

app.get('/api-config', (req, res) => {
  res.json({ apiKey: process.env.GOOGLE_MAPS_API_KEY });
});

app.listen(port, () => {
  console.log(`\n Server pronto! Apri il browser su: http://localhost:${port}`);
});
