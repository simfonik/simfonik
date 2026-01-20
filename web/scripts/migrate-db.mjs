#!/usr/bin/env node
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { sql } from '@vercel/postgres';

// Load .env.local manually
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
  console.log('✓ Loaded environment variables from .env.local');
} catch (error) {
  console.error('Warning: Could not load .env.local:', error.message);
}

async function migrate() {
  console.log('Running database migration...');

  try {
    // Create comments table
    await sql`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        tape_id VARCHAR(255) NOT NULL,
        author_name VARCHAR(100) NOT NULL,
        author_email VARCHAR(255),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        approved BOOLEAN DEFAULT FALSE
      );
    `;
    console.log('✓ Created comments table');

    // Create indexes for comments
    await sql`CREATE INDEX IF NOT EXISTS idx_tape_approved ON comments(tape_id, approved);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_created_at_desc ON comments(created_at DESC);`;
    console.log('✓ Created comments indexes');

    // Create rate_limits table
    await sql`
      CREATE TABLE IF NOT EXISTS rate_limits (
        ip_hash VARCHAR(64) PRIMARY KEY,
        count INTEGER DEFAULT 1,
        reset_at TIMESTAMPTZ NOT NULL
      );
    `;
    console.log('✓ Created rate_limits table');

    // Create index for rate_limits
    await sql`CREATE INDEX IF NOT EXISTS idx_reset_at ON rate_limits(reset_at);`;
    console.log('✓ Created rate_limits index');

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
