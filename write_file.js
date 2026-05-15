const fs=require('fs');
const content=const express=require('express');
const cors=require('cors');
const {pool}=require('./database');
require('dotenv').config();

const app=express();
const PORT=process.env.PORT||3000;

app.use(cors());
app.use(express.json());

const authRoutes=require('./routes/auth');
const vehicleRoutes=require('./routes/vehicles');
const tripRoutes=require('./routes/trips');
const surveyRoutes=require('./routes/surveys');

app.use('/api/auth',authRoutes);
app.use('/api/vehicles',vehicleRoutes);
app.use('/api/trips',tripRoutes);
app.use('/api/surveys',surveyRoutes);

app.get('/health',async(req,res)=>{try{await pool.query('SELECT 1');res.json({status:'ok',database:'connected',timestamp:new Date().toISOString()});}catch(err){res.status(500).json({status:'error',database:'disconnected'});}});

app.listen(PORT,()=>{console.log('Control Tower kjoerer paa port '+PORT);});
;
fs.writeFileSync('server.js',content);
console.log('server.js skrevet!');
