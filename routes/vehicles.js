const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// GET /api/vehicles — hent alle biler
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM vehicles ORDER BY created_at DESC'
    );
    res.json({ success: true, count: result.rows.length, vehicles: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/vehicles/:vin — hent én bil på VIN
router.get('/:vin', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM vehicles WHERE vin = $1',
      [req.params.vin.toUpperCase()]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'VIN ikke funnet' });
    }
    res.json({ success: true, vehicle: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/vehicles — legg inn ny bil
router.post('/', async (req, res) => {
  const { vin, make, model, year, color, weight_kg, hsr_code, batch_reference } = req.body;
  if (!vin) return res.status(400).json({ success: false, error: 'VIN er påkrevd' });
  try {
    const result = await pool.query(
      `INSERT INTO vehicles (vin, make, model, year, color, weight_kg, hsr_code, batch_reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [vin.toUpperCase(), make, model, year, color, weight_kg, hsr_code, batch_reference]
    );
    res.status(201).json({ success: true, vehicle: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ success: false, error: 'VIN finnes allerede' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;