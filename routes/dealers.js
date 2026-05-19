const express = require('express');
const router = express.Router();
const pool = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const role = req.user.role;
    if (role !== 'autosped' && role !== 'oem') return res.status(403).json({ success: false, error: 'Ingen tilgang' });
    let query = `SELECT d.*, COUNT(v.id) as vehicle_count FROM dealers d LEFT JOIN vehicles v ON v.dealer_id = d.id`;
    const params = [], conditions = [];
    if (role === 'oem') { conditions.push(`d.oem_id = $${params.length+1}`); params.push(req.user.oem_id); }
    if (req.query.country) { conditions.push(`d.country = $${params.length+1}`); params.push(req.query.country); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' GROUP BY d.id ORDER BY d.name ASC';
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const role = req.user.role;
    if (role !== 'autosped' && role !== 'oem' && role !== 'dealer') return res.status(403).json({ success: false, error: 'Ingen tilgang' });
    if (role === 'dealer' && req.user.dealer_id !== parseInt(req.params.id)) return res.status(403).json({ success: false, error: 'Kan kun se egen forhandler' });
    const result = await pool.query(`SELECT d.*, COUNT(v.id) as vehicle_count FROM dealers d LEFT JOIN vehicles v ON v.dealer_id = d.id WHERE d.id = $1 GROUP BY d.id`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Forhandler ikke funnet' });
    if (role === 'oem' && result.rows[0].oem_id !== req.user.oem_id) return res.status(403).json({ success: false, error: 'Ingen tilgang' });
    res.json({ success: true, data: result.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'autosped') return res.status(403).json({ success: false, error: 'Kun Autosped kan opprette forhandlere' });
    const { name, oem_id, country, city, address, contact_email, contact_phone } = req.body;
    if (!name || !oem_id || !country) return res.status(400).json({ success: false, error: 'name, oem_id og country er påkrevd' });
    const result = await pool.query(`INSERT INTO dealers (name, oem_id, country, city, address, contact_email, contact_phone) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [name, oem_id, country, city||null, address||null, contact_email||null, contact_phone||null]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'autosped') return res.status(403).json({ success: false, error: 'Kun Autosped kan redigere forhandlere' });
    const { name, oem_id, country, city, address, contact_email, contact_phone } = req.body;
    const result = await pool.query(`UPDATE dealers SET name=COALESCE($1,name), oem_id=COALESCE($2,oem_id), country=COALESCE($3,country), city=COALESCE($4,city), address=COALESCE($5,address), contact_email=COALESCE($6,contact_email), contact_phone=COALESCE($7,contact_phone), updated_at=NOW() WHERE id=$8 RETURNING *`, [name, oem_id, country, city, address, contact_email, contact_phone, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Forhandler ikke funnet' });
    res.json({ success: true, data: result.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'autosped') return res.status(403).json({ success: false, error: 'Kun Autosped kan slette forhandlere' });
    const result = await pool.query('DELETE FROM dealers WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Forhandler ikke funnet' });
    res.json({ success: true, message: 'Forhandler slettet' });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

module.exports = router;
