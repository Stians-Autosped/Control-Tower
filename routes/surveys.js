const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { authenticate, authorize } = require('../middleware/auth');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres123@localhost:5432/controltower'
});

// GET alle surveys
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM surveys ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET én survey
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM surveys WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Survey ikke funnet' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST ny survey
router.post('/', authenticate, authorize('autosped', 'surveyor'), async (req, res) => {
  const { vehicle_id, trip_id, survey_type, location, gps_lat, gps_lng } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO surveys (vehicle_id, trip_id, surveyor_id, survey_type, location, gps_lat, gps_lng, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [vehicle_id, trip_id, req.user.id, survey_type, location, gps_lat, gps_lng, 'in_progress']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT oppdater survey
router.put('/:id', authenticate, authorize('autosped', 'surveyor'), async (req, res) => {
  const { status, photos_taken, submitted_at } = req.body;
  try {
    const result = await pool.query(
      'UPDATE surveys SET status=COALESCE($1,status), photos_taken=COALESCE($2,photos_taken), submitted_at=COALESCE($3,submitted_at) WHERE id=$4 RETURNING *',
      [status, photos_taken, submitted_at, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Survey ikke funnet' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;