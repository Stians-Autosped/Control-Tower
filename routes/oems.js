const express = require('express');
const router = express.Router();
const pool = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'autosped') return res.status(403).json({ success: false, error: 'Kun Autosped kan se alle OEM-er' });
    const result = await pool.query(`SELECT o.*, COUNT(DISTINCT v.id) as vehicle_count, COUNT(DISTINCT d.id) as dealer_count FROM oems o LEFT JOIN vehicles v ON v.oem_id = o.id LEFT JOIN dealers d ON d.oem_id = o.id GROUP BY o.id ORDER BY o.name ASC`);
    res.json({ success: true, data: result.rows });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const role = req.user.role;
    if (role !== 'autosped' && role !== 'oem') return res.status(403).json({ success: false, error: 'Ingen tilgang' });
    if (role === 'oem' && req.user.oem_id !== parseInt(req.params.id)) return res.status(403).json({ success: false, error: 'Kan kun se egen OEM' });
    const result = await pool.query(`SELECT o.*, COUNT(DISTINCT v.id) as vehicle_count, COUNT(DISTINCT d.id) as dealer_count FROM oems o LEFT JOIN vehicles v ON v.oem_id = o.id LEFT JOIN dealers d ON d.oem_id = o.id WHERE o.id = $1 GROUP BY o.id`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'OEM ikke funnet' });
    res.json({ success: true, data: result.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'autosped') return res.status(403).json({ success: false, error: 'Kun Autosped kan opprette OEM-er' });
    const { name, country, contact_email, contact_phone, website } = req.body;
    if (!name || !country) return res.status(400).json({ success: false, error: 'name og country er påkrevd' });
    const result = await pool.query(`INSERT INTO oems (name, country, contact_email, contact_phone, website) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [name, country, contact_email||null, contact_phone||null, website||null]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'autosped') return res.status(403).json({ success: false, error: 'Kun Autosped kan redigere OEM-er' });
    const { name, country, contact_email, contact_phone, website } = req.body;
    const result = await pool.query(`UPDATE oems SET name=COALESCE($1,name), country=COALESCE($2,country), contact_email=COALESCE($3,contact_email), contact_phone=COALESCE($4,contact_phone), website=COALESCE($5,website), updated_at=NOW() WHERE id=$6 RETURNING *`, [name, country, contact_email, contact_phone, website, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'OEM ikke funnet' });
    res.json({ success: true, data: result.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'autosped') return res.status(403).json({ success: false, error: 'Kun Autosped kan slette OEM-er' });
    const result = await pool.query('DELETE FROM oems WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'OEM ikke funnet' });
    res.json({ success: true, message: 'OEM slettet' });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

module.exports = router;
