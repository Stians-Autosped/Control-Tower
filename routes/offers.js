const express = require('express');
const router = express.Router();
const pool = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const role = req.user.role;
    let query = `SELECT o.*, c.description as claim_description, c.amount as claim_amount, c.status as claim_status, v.vin, v.make, v.model FROM offers o JOIN claims c ON o.claim_id = c.id JOIN damages d ON c.damage_id = d.id JOIN surveys s ON d.survey_id = s.id JOIN vehicles v ON s.vehicle_id = v.id`;
    const params = [], conditions = [];
    if (role === 'oem') { conditions.push(`v.oem_id = $${params.length+1}`); params.push(req.user.oem_id); }
    if (role === 'dealer') { conditions.push(`v.dealer_id = $${params.length+1}`); params.push(req.user.dealer_id); }
    if (req.query.claim_id) { conditions.push(`o.claim_id = $${params.length+1}`); params.push(req.query.claim_id); }
    if (req.query.status) { conditions.push(`o.status = $${params.length+1}`); params.push(req.query.status); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY o.created_at DESC';
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`SELECT o.*, c.description as claim_description, c.amount as claim_amount, v.vin, v.make, v.model, v.oem_id FROM offers o JOIN claims c ON o.claim_id = c.id JOIN damages d ON c.damage_id = d.id JOIN surveys s ON d.survey_id = s.id JOIN vehicles v ON s.vehicle_id = v.id WHERE o.id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Tilbud ikke funnet' });
    const offer = result.rows[0];
    if (req.user.role === 'oem' && offer.oem_id !== req.user.oem_id) return res.status(403).json({ success: false, error: 'Ingen tilgang' });
    res.json({ success: true, data: offer });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'autosped') return res.status(403).json({ success: false, error: 'Kun Autosped kan opprette tilbud' });
    const { claim_id, amount, description, valid_until } = req.body;
    if (!claim_id || !amount || !description) return res.status(400).json({ success: false, error: 'claim_id, amount og description er påkrevd' });
    const claimCheck = await pool.query('SELECT id FROM claims WHERE id = $1', [claim_id]);
    if (claimCheck.rows.length === 0) return res.status(404).json({ success: false, error: 'Claim ikke funnet' });
    const result = await pool.query(`INSERT INTO offers (claim_id, amount, description, valid_until, status, created_by) VALUES ($1,$2,$3,$4,'pending',$5) RETURNING *`, [claim_id, amount, description, valid_until||null, req.user.id]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const role = req.user.role;
    if (role !== 'autosped' && role !== 'oem') return res.status(403).json({ success: false, error: 'Ingen tilgang' });
    const { amount, description, valid_until, status } = req.body;
    const validStatuses = ['pending','accepted','rejected','countered'];
    if (status && !validStatuses.includes(status)) return res.status(400).json({ success: false, error: 'Ugyldig status' });
    if (role === 'oem' && (amount || description || valid_until)) return res.status(403).json({ success: false, error: 'OEM kan kun endre status' });
    const result = await pool.query(`UPDATE offers SET amount=COALESCE($1,amount), description=COALESCE($2,description), valid_until=COALESCE($3,valid_until), status=COALESCE($4,status), updated_at=NOW() WHERE id=$5 RETURNING *`, [amount, description, valid_until, status, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Tilbud ikke funnet' });
    res.json({ success: true, data: result.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'autosped') return res.status(403).json({ success: false, error: 'Kun Autosped kan slette tilbud' });
    const result = await pool.query('DELETE FROM offers WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Tilbud ikke funnet' });
    res.json({ success: true, message: 'Tilbud slettet' });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

module.exports = router;
