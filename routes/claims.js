const express = require('express');
const router = express.Router();
const pool = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const role = req.user.role;
    let query = `SELECT c.*, v.vin, v.make, v.model, d.damage_code, d.zone, d.severity FROM claims c JOIN damages d ON c.damage_id = d.id JOIN surveys s ON d.survey_id = s.id JOIN vehicles v ON s.vehicle_id = v.id`;
    const params = [], conditions = [];
    if (role === 'oem') { conditions.push(`v.oem_id = $${params.length+1}`); params.push(req.user.oem_id); }
    if (role === 'dealer') { conditions.push(`v.dealer_id = $${params.length+1}`); params.push(req.user.dealer_id); }
    if (req.query.status) { conditions.push(`c.status = $${params.length+1}`); params.push(req.query.status); }
    if (req.query.vehicle_id) { conditions.push(`v.id = $${params.length+1}`); params.push(req.query.vehicle_id); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY c.created_at DESC';
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`SELECT c.*, v.vin, v.make, v.model, v.oem_id, d.damage_code, d.zone, d.severity, d.description FROM claims c JOIN damages d ON c.damage_id = d.id JOIN surveys s ON d.survey_id = s.id JOIN vehicles v ON s.vehicle_id = v.id WHERE c.id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Claim ikke funnet' });
    const claim = result.rows[0];
    if (req.user.role === 'oem' && claim.oem_id !== req.user.oem_id) return res.status(403).json({ success: false, error: 'Ingen tilgang' });
    res.json({ success: true, data: claim });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const role = req.user.role;
    if (role !== 'autosped' && role !== 'oem') return res.status(403).json({ success: false, error: 'Ingen tilgang' });
    const { damage_id, description, amount } = req.body;
    if (!damage_id || !description) return res.status(400).json({ success: false, error: 'damage_id og description er påkrevd' });
    const result = await pool.query(`INSERT INTO claims (damage_id, description, amount, status, created_by) VALUES ($1,$2,$3,'open',$4) RETURNING *`, [damage_id, description, amount||null, req.user.id]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const role = req.user.role;
    if (role !== 'autosped' && role !== 'oem') return res.status(403).json({ success: false, error: 'Ingen tilgang' });
    const { description, amount, status } = req.body;
    const validStatuses = ['open','in_review','approved','rejected','closed'];
    if (status && !validStatuses.includes(status)) return res.status(400).json({ success: false, error: 'Ugyldig status' });
    const result = await pool.query(`UPDATE claims SET description=COALESCE($1,description), amount=COALESCE($2,amount), status=COALESCE($3,status), updated_at=NOW() WHERE id=$4 RETURNING *`, [description, amount, status, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Claim ikke funnet' });
    res.json({ success: true, data: result.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'autosped') return res.status(403).json({ success: false, error: 'Kun Autosped kan slette claims' });
    const result = await pool.query('DELETE FROM claims WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Claim ikke funnet' });
    res.json({ success: true, message: 'Claim slettet' });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

module.exports = router;
