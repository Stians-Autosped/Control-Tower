const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Database tilkobling
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('DATABASE FEIL:', err.message);
  } else {
    console.log('Database tilkoblet!');
    release();
  }
});

// Routes
const vehiclesRouter = require('./routes/vehicles');
app.use('/api/vehicles', vehiclesRouter);
const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);
// Status
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