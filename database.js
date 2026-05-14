const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function createTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS oems (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        short_name VARCHAR(50),
        currency VARCHAR(3) DEFAULT 'NOK',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ oems tabell OK');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS dealers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        oem_id UUID REFERENCES oems(id),
        name VARCHAR(255) NOT NULL,
        city VARCHAR(100),
        delivery_address TEXT,
        delivery_instructions TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ dealers tabell OK');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_number VARCHAR(50) UNIQUE NOT NULL,
        origin_location VARCHAR(255),
        destination_location VARCHAR(255),
        departure_date DATE,
        arrival_date_est DATE,
        arrival_date_actual DATE,
        status VARCHAR(50) DEFAULT 'planned',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ trips tabell OK');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        oem_id UUID REFERENCES oems(id),
        dealer_id UUID REFERENCES dealers(id),
        trip_id UUID REFERENCES trips(id),
        vin VARCHAR(17) UNIQUE NOT NULL,
        make VARCHAR(100),
        model VARCHAR(100),
        year INTEGER,
        color VARCHAR(100),
        interior VARCHAR(100),
        weight_kg INTEGER,
        hsr_code VARCHAR(20),
        batch_reference VARCHAR(100),
        status VARCHAR(50) DEFAULT 'at_port',
        est_delivery_date DATE,
        delivered_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ vehicles tabell OK');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        oem_id UUID REFERENCES oems(id),
        dealer_id UUID REFERENCES dealers(id),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ users tabell OK');

    console.log('\n🎉 Alle tabeller er klare!');
    process.exit(0);
  } catch (err) {
    console.error('FEIL:', err.message);
    process.exit(1);
  }
}

createTables();