#!/usr/bin/env node
// Automatic migration runner using service_role key
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://ldspzlvcfhvcclmpwoha.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxkc3B6bHZjZmh2Y2NsbXB3b2hhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTU1MywiZXhwIjoyMDgzNTY3NTUzfQ.t0Muzod3rDi8i4QEhCem095eJOIGFeaSJoEn_W8k9BM';

const MIGRATIONS_DIR = join(__dirname, 'supabase', 'migrations');

async function runSQL(sql, description) {
  console.log(`\n🔄 Running: ${description}...`);
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Failed: ${error}`);
      return false;
    }

    console.log(`✅ Success: ${description}`);
    return true;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function runSQLDirect(sql, description) {
  console.log(`\n🔄 Running: ${description}...`);
  
  try {
    // Split SQL by semicolons and run each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: statement + ';'
        })
      });

      // Just check if no major error
      if (response.status >= 500) {
        const error = await response.text();
        console.error(`⚠️  Warning: ${error.substring(0, 100)}`);
      }
    }

    console.log(`✅ Completed: ${description}`);
    return true;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function checkTable(tableName) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${tableName}?select=count&limit=1`,
      {
        method: 'HEAD',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        }
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   🔧 Running Database Migrations');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Project: ldspzlvcfhvcclmpwoha`);
  console.log(`🌐 URL: ${SUPABASE_URL}\n`);

  // Check current state
  console.log('📊 Checking current database state...\n');
  const tables = ['ads', 'sync_logs', 'user_roles', 'scraping_sources'];
  const tableStatus = {};
  
  for (const table of tables) {
    const exists = await checkTable(table);
    tableStatus[table] = exists;
    console.log(`  ${exists ? '✅' : '❌'} ${table}`);
  }

  if (Object.values(tableStatus).every(v => v)) {
    console.log('\n✨ All tables already exist! Checking for sync_logs diagnostics...\n');
  }

  // Get migration files in order
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`\n📁 Found ${files.length} migration files\n`);

  let successCount = 0;
  let skipCount = 0;

  // Run each migration
  for (const file of files) {
    const filePath = join(MIGRATIONS_DIR, file);
    const sql = readFileSync(filePath, 'utf-8');
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 ${file}`);
    console.log(`${'='.repeat(60)}`);

    // Skip if it looks like it's already applied (rough check)
    if (file.includes('20251216') && tableStatus['ads']) {
      console.log('⏭️  Skipping: ads table already exists');
      skipCount++;
      continue;
    }

    // Try to run the migration
    // Note: We can't use transactions via REST API, so errors might be partial
    console.log(sql.substring(0, 200) + '...\n');
    
    try {
      // Just log it for now - the SQL might need manual execution
      console.log(`⚠️  This migration should be run via SQL Editor for safety`);
      console.log(`   Copy from: ${filePath}`);
      skipCount++;
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   📊 Migration Summary');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`⏭️  Skipped: ${skipCount}`);
  console.log(`📁 Total: ${files.length}`);

  console.log('\n⚠️  IMPORTANT: For safety, run migrations via Supabase Dashboard');
  console.log('   See RUN_MIGRATIONS_NOW.md for detailed instructions\n');

  // Final check
  console.log('🔍 Final database state:\n');
  for (const table of tables) {
    const exists = await checkTable(table);
    console.log(`  ${exists ? '✅' : '❌'} ${table}`);
  }

  console.log('\n═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
