import 'dotenv/config'; 
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use(express.static('public'));


// DB CONFIGURATION & MODELS (MongoDB)

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/napstop';
mongoose.connect(mongoUri)
  .then(() => console.log('Connesso con successo a MongoDB!'))
  .catch(err => console.error('Errore di connessione a MongoDB:', err));

// Schema Utente
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// Schema Viaggio
const viaggioSchema = new mongoose.Schema({
  utenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  destinazione: { type: String, required: true },
  mezzo: { type: String, required: true },
  raggio: { type: String, required: true },
  notifica: { type: String, required: true },
  dataCreazione: { type: Date, default: Date.now }
});
const Viaggio = mongoose.model('Viaggio', viaggioSchema);


// MIDDLEWARE DI AUTENTICAZIONE (JWT)

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

// ROTTE API

app.post('/api/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ errore: 'Email e password sono obbligatorie.' });
    }

    // Controlla se l'utente esiste già
    const utenteEsistente = await User.findOne({ email });
    if (utenteEsistente) {
      return res.status(400).json({ errore: 'Questa email è già registrata.' });
    }

    // Cripta la password
    const salt = await bcrypt.genSalt(10);
    const passwordCriptata = await bcrypt.hash(password, salt);

    // Salva nel DB
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

    // Cerca l'utente
    const utente = await User.findOne({ email });
    if (!utente) {
      return res.status(400).json({ errore: 'Email o password errate.' });
    }

    // Controlla la password
    const passwordValida = await bcrypt.compare(password, utente.password);
    if (!passwordValida) {
      return res.status(400).json({ errore: 'Email o password errate.' });
    }

    // Genera il Token JWT valido per 24 ore
    const token = jwt.sign({ userId: utente._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({ messaggio: 'Login effettuato con successo!', token });
  } catch (error) {
    console.error('Errore Login:', error);
    res.status(500).json({ errore: 'Errore nel server durante il login.' });
  }
});

app.post('/api/viaggi', autenticaToken, async (req, res) => {
  try {
    const { destinazione, mezzo, raggio, notifica } = req.body;

    const nuovoViaggio = new Viaggio({
      utenteId: req.userId, // Preso in automatico dal token JWT decodificato
      destinazione,
      mezzo,
      raggio,
      notifica
    });

    await nuovoViaggio.save();
    res.status(201).json({ messaggio: 'Viaggio salvato nel database con successo!', viaggio: nuovoViaggio });
  } catch (error) {
    console.error('Errore Salvataggio Viaggio:', error);
    res.status(500).json({ errore: 'Impossibile salvare il viaggio nel database.' });
  }
});

app.get('/api-config', (req, res) => {
  res.json({ apiKey: process.env.GOOGLE_MAPS_API_KEY });
});

app.listen(port, () => {
  console.log(`\n Server pronto! Apri il browser su: http://localhost:${port}`);
});
