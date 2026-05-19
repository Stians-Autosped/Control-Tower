const express = require('express');
const router = express.Router();
const pool = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { survey_id, vehicle_id, claim_flagged } = req.query;
    const role = req.user.role;
    let query = `SELECT d.*, s.vehicle_id, s.survey_type, s.location, v.vin, v.make, v.model, u.name as surveyor_name FROM damages d JOIN surveys s ON d.survey_id = s.id JOIN vehicles v ON s.vehicle_id = v.id LEFT JOIN users u ON s.surveyor_id = u.id`;
    const params = [], conditions = [];
    if (role === 'oem' && req.user.oem_id) { conditions.push(`v.oem_id = $${params.length+1}`); params.push(req.user.oem_id); }
    if (role === 'dealer') { conditions.push(`v.dealer_id = $${params.length+1}`); params.push(req.user.dealer_id); }
    if (survey_id) { conditions.push(`d.survey_id = $${params.length+1}`); params.push(survey_id); }
    if (vehicle_id) { conditions.push(`s.vehicle_id = $${params.length+1}`); params.push(vehicle_id); }
    if (claim_flagged !== undefined) { conditions.push(`d.claim_flagged = $${params.length+1}`); params.push(claim_flagged==='true'); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY d.created_at DESC';
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.get('/meta/codes', authenticate, async (req, res) => {
  const codes = [{code:'SCR',label:'Scratch/Ripe'},{code:'DEN',label:'Dent/Bulk'},{code:'CHI',label:'Chip/Steinsprut'},{code:'CRK',label:'Crack/Sprekk'},{code:'BRK',label:'Broken/Knust'},{code:'MIS',label:'Missing/Mangler'},{code:'STN',label:'Stain/Flekk'},{code:'DEF',label:'Deformation'},{code:'COR',label:'Corrosion/Rust'},{code:'OTH',label:'Other/Annet'}];
  const zones = ['front','rear','left','right','roof','underbody','interior','windshield','rear_window'];
  res.json({ success: true, data: { codes, zones, severity_scale: '1-5 (AIAG-ECG)' } });
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`SELECT d.*, s.vehicle_id, v.vin, v.make, v.model, v.oem_id, u.name as surveyor_name FROM damages d JOIN surveys s ON d.survey_id = s.id JOIN vehicles v ON s.vehicle_id = v.id LEFT JOIN users u ON s.surveyor_id = u.id WHERE d.id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Skade ikke funnet' });
    const damage = result.rows[0];
    if (req.user.role === 'oem' && damage.oem_id !== req.user.oem_id) return res.status(403).json({ success: false, error: 'Ingen tilgang' });
    res.json({ success: true, data: damage });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const role = req.user.role;
    if (role !== 'autosped' && role !== 'surveyor') return res.status(403).json({ success: false, error: 'Ingen tilgang' });
    const { survey_id, damage_code, damage_type, zone, severity, description, claim_flagged, position_x, position_y } = req.body;
    if (!survey_id || !damage_code || !zone || !severity) return res.status(400).json({ success: false, error: 'survey_id, damage_code, zone og severity er påkrevd' });
    if (severity < 1 || severity > 5) return res.status(400).json({ success: false, error: 'Severity må være mellom 1 og 5' });
    const sc = await pool.query('SELECT id, surveyor_id FROM surveys WHERE id = $1', [survey_id]);
    if (sc.rows.length === 0) return res.status(404).json({ success: false, error: 'Survey ikke funnet' });
    if (role === 'surveyor' && sc.rows[0].surveyor_id !== req.user.id) return res.status(403).json({ success: false, error: 'Kun egne surveys' });
    const result = await pool.query(`INSERT INTO damages (survey_id,damage_code,damage_type,zone,severity,description,claim_flagged,position_x,position_y,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [survey_id,damage_code,damage_type||null,zone,severity,description||null,claim_flagged||false,position_x||null,position_y||null,req.user.id]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const role = req.user.role;
    if (role !== 'autosped' && role !== 'surveyor') return res.status(403).json({ success: false, error: 'Ingen tilgang' });
    const ex = await pool.query(`SELECT d.*, s.surveyor_id FROM damages d JOIN surveys s ON d.survey_id = s.id WHERE d.id = $1`, [req.params.id]);
    if (ex.rows.length === 0) return res.status(404).json({ success: false, error: 'Skade ikke funnet' });
    if (role === 'surveyor' && ex.rows[0].surveyor_id !== req.user.id) return res.status(403).json({ success: false, error: 'Kun egne skader' });
    const { damage_code, damage_type, zone, severity, description, claim_flagged, position_x, position_y } = req.body;
    if (severity && (severity < 1 || severity > 5)) return res.status(400).json({ success: false, error: 'Severity 1-5' });
    const result = await pool.query(`UPDATE damages SET damage_code=COALESCE($1,damage_code),damage_type=COALESCE($2,damage_type),zone=COALESCE($3,zone),severity=COALESCE($4,severity),description=COALESCE($5,description),claim_flagged=COALESCE($6,claim_flagged),position_x=COALESCE($7,position_x),position_y=COALESCE($8,position_y),updated_at=NOW() WHERE id=$9 RETURNING *`, [damage_code,damage_type,zone,severity,description,claim_flagged,position_x,position_y,req.params.id]);
    res.json({ success: true, data: result.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

router.delete('/:id', authenticate, authorize('autosped'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM damages WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Skade ikke funnet' });
    res.json({ success: true, message: 'Skade slettet' });
  } catch(err) { console.error(err); res.status(500).json({ success: false, error: 'Serverfeil' }); }
});

module.exports = router;
