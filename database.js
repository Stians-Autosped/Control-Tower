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
        vat_rate DECIMAL(5,2) DEFAULT 25.00,
        claim_recipients JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ oems OK');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS dealers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        oem_id UUID REFERENCES oems(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        city VARCHAR(100),
        delivery_address TEXT,
        delivery_instructions TEXT,
        invoice_recipient VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ dealers OK');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        oem_id UUID REFERENCES oems(id) ON DELETE SET NULL,
        dealer_id UUID REFERENCES dealers(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        role VARCHAR(50) NOT NULL CHECK (role IN ('autosped','oem','dealer','surveyor')),
        auth_method VARCHAR(20) DEFAULT 'password',
        totp_secret VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ users OK');

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
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ trips OK');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trip_legs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
        leg_order INTEGER NOT NULL,
        mode VARCHAR(20) NOT NULL CHECK (mode IN ('sea','road','rail')),
        origin VARCHAR(255),
        destination VARCHAR(255),
        vessel_name VARCHAR(255),
        shipping_company VARCHAR(255),
        truck_reg VARCHAR(50),
        freight_company VARCHAR(255),
        driver_name VARCHAR(255),
        departure_date_est DATE,
        departure_date_actual DATE,
        arrival_date_est DATE,
        arrival_date_actual DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ trip_legs OK');

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
        item_number VARCHAR(100),
        registration_number VARCHAR(50),
        status VARCHAR(50) DEFAULT 'at_port',
        est_delivery_date DATE,
        delivered_at TIMESTAMPTZ,
        custom_fields JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ vehicles OK');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS offers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        oem_id UUID REFERENCES oems(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        currency VARCHAR(3) DEFAULT 'NOK',
        valid_from DATE,
        valid_to DATE,
        is_active BOOLEAN DEFAULT TRUE,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ offers OK');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS offer_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        offer_id UUID REFERENCES offers(id) ON DELETE CASCADE,
        owner VARCHAR(20) NOT NULL CHECK (owner IN ('autosped','oem')),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        unit_price DECIMAL(12,2) NOT NULL,
        vat_code VARCHAR(20),
        vat_amount DECIMAL(12,2) DEFAULT 0,
        dealer_visible BOOLEAN DEFAULT FALSE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ offer_lines OK');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehicle_costs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
        offer_line_id UUID REFERENCES offer_lines(id),
        name VARCHAR(255) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        vat_amount DECIMAL(12,2) DEFAULT 0,
        currency VARCHAR(3) DEFAULT 'NOK',
        dealer_visible BOOLEAN DEFAULT FALSE,
        is_credited BOOLEAN DEFAULT FALSE,
        credited_by UUID REFERENCES users(id),
        credited_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ vehicle_costs OK');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS surveys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
        trip_id UUID REFERENCES trips(id),
        surveyor_id UUID REFERENCES users(id),
        survey_type VARCHAR(20) NOT NULL CHECK (survey_type IN ('arrival','ubc','delivery','loading')),
        location VARCHAR(255),
        gps_lat DECIMAL(10,7),
        gps_lng DECIMAL(10,7),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
        photos_required INTEGER DEFAULT 7,
        photos_taken INTEGER DEFAULT 0,
        submitted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ surveys OK');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS survey_photos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
        photo_type VARCHAR(50) NOT NULL,
        url VARCHAR(500) NOT NULL,
        gps_lat DECIMAL(10,7),
        gps_lng DECIMAL(10,7),
        taken_at TIMESTAMPTZ,
        is_required BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ survey_photos OK');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS damages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
        zone VARCHAR(10) NOT NULL,
        damage_type VARCHAR(5) NOT NULL,
        severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5),
        damage_code VARCHAR(20),
        description TEXT,
        claim_draft BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ damages OK');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        damage_id UUID REFERENCES damages(id),
        vehicle_id UUID REFERENCES vehicles(id),
        survey_id UUID REFERENCES surveys(id),
        claim_number VARCHAR(50) UNIQUE,
        status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','review','sent','closed')),
        description TEXT,
        internal_notes TEXT,
        recipients JSONB DEFAULT '[]',
        deadline_48h TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        sent_by UUID REFERENCES users(id),
        pdf_url VARCHAR(500),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ claims OK');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS co2_routes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        origin VARCHAR(255) NOT NULL,
        destination VARCHAR(255) NOT NULL,
        mode VARCHAR(20) NOT NULL CHECK (mode IN ('sea','road','rail')),
        distance_km INTEGER,
        co2_per_km_per_ton DECIMAL(10,4),
        factor_set_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ co2_routes OK');

    console.log('\n🎉 Alle 14 tabeller er klare!');
    process.exit(0);
  } catch (err) {
    console.error('FEIL:', err.message);
    process.exit(1);
  }
}

createTables();