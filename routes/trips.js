const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres123@localhost:5432/controltower'
});

// GET alle trips
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM trips ORDER BY created_at DESC'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET én trip på id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM trips WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Trip ikke funnet' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST ny trip
router.post('/', async (req, res) => {
  const {
    trip_number,
    origin_location,
    destination_location,
    status,
    departure_date,
    arrival_date_est,
    arrival_date_actual
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO trips 
        (trip_number, origin_location, destination_location, status, departure_date, arrival_date_est, arrival_date_actual)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [trip_number, origin_location, destination_location, status || 'planned',
       departure_date, arrival_date_est, arrival_date_actual]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT oppdater trip
router.put('/:id', async (req, res) => {
  const {
    origin_location,
    destination_location,
    status,
    departure_date,
    arrival_date_est,
    arrival_date_actual
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE trips SET
        origin_location = COALESCE($1, origin_location),
        destination_location = COALESCE($2, destination_location),
        status = COALESCE($3, status),
        departure_date = COALESCE($4, departure_date),
        arrival_date_est = COALESCE($5, arrival_date_est),
        arrival_date_actual = COALESCE($6, arrival_date_actual)
       WHERE id = $7
       RETURNING *`,
      [origin_location, destination_location, status,
       departure_date, arrival_date_est, arrival_date_actual, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Trip ikke funnet' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE trip
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM trips WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Trip ikke funnet' });
    }
    res.json({ success: true, message: 'Trip slettet' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;