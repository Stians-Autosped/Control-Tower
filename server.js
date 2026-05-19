const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Database tilkoblingsfeil:', err.message);
  } else {
    console.log('Database tilkoblet!');
    release();
  }
});

const vehiclesRouter = require('./routes/vehicles');
const authRouter = require('./routes/auth');
const tripsRouter = require('./routes/trips');
const surveysRouter = require('./routes/surveys');
const damagesRouter = require('./routes/damages');
const claimsRouter = require('./routes/claims');
const offersRouter = require('./routes/offers');
const dealersRouter = require('./routes/dealers');
const oemsRouter = require('./routes/oems');

app.use('/api/vehicles', vehiclesRouter);
app.use('/api/auth', authRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/surveys', surveysRouter);
app.use('/api/oems', oemsRouter);
app.use('/api/dealers', dealersRouter);
app.use('/api/offers', offersRouter);
app.use('/api/claims', claimsRouter);
app.use('/api/damages', damagesRouter);

app.get('/', (req, res) => {
  res.json({ system: 'Control Tower', company: 'Autosped AS', status: 'running', version: '1.0.0' });
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

app.listen(PORT, () => {
  console.log(`Control Tower kjører på http://localhost:${PORT}`);
});
