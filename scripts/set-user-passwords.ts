/**
 * One-time script to set passwords for existing users
 *
 * Usage: npx tsx scripts/set-user-passwords.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';
import crypto from 'crypto';

// Users and their passwords to set
const USERS_TO_UPDATE = [
  { email: 'anfrage@buchenau-comedy.de', password: '637pow7(>B8Y' },
  { email: 'ute@taste-the-city.eu', password: '|CZdf4C9\\59|' },
  { email: 'pr@heidi-rauch.de', password: '1KO8&(pH=A51' },
  { email: 'info@raise-your-spirits.at', password: 'tyNuUt$}.492' },
  { email: 'info@wein-augsburg.de', password: 'ZP/33T8H(+z8' },
  { email: 'kontakt@dittmers-kochlounge.de', password: 'XcMfY^288Cf5' },
  { email: 'christian@menzinger-weinladen.de', password: '>9U7=U<6|hzT' },
  { email: 'info@gourmets-for-Nature.de', password: "M51}_ai;H'9]" },
  { email: 'info@vino-gusto.de', password: 'p91Q::K6RIl3' },
  { email: 'mapo@2cyou.de', password: '£wOJ6PXDWe07' },
  { email: 'email@mehr-vom-essen.de', password: 'BmI10Z*68#iw' },
  { email: 'tino.polaski@kochagentur.info', password: '>N5<tk)J;08L' },
  { email: 'info@bambi-barakademie.de', password: '9CoP:+1u]1[C' },
  { email: 'info@studio32.berlin', password: 'T7:J5Mp6t|>U' },
  { email: 'daniel.piterna@yahoo.com', password: '%48d5o?tuJZq' },
  { email: 'info@sardovino.de', password: 'dsU4;657:4>]' },
  { email: 'info@backzeit-backstudio.de', password: "pGC6gs99)T'@" },
  { email: 'info@barista-academy.eu', password: '£%537[J4Ts0o' },
  { email: 'info@juliankutos.com', password: 'H3e4K2PC£3{Z' },
  { email: 'info@foodatlas.de', password: '85j@+Oo<5]Wg' },
  { email: 'testa4toptech@gmail.com', password: '12345678' },
  { email: 'admin@boni-brands.com', password: '12345678' },
];

async function getPool(): Promise<Pool> {
  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DATABASE;

  if (host && user && password && database) {
    return new Pool({
      host,
      port: port ? parseInt(port, 10) : 5432,
      user,
      password,
      database,
    });
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Database connection not configured');
  }

  return new Pool({ connectionString });
}

async function main() {
  console.log('=== Setting User Passwords ===\n');

  const pool = await getPool();

  let successCount = 0;
  let failCount = 0;
  const failures: string[] = [];

  for (const { email, password } of USERS_TO_UPDATE) {
    try {
      // Hash the password using SHA256 (n8n compatible)
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

      // Update user in database
      const result = await pool.query(
        `UPDATE miomente_partner_portal_users
         SET password = $1
         WHERE LOWER(email) = LOWER($2)`,
        [passwordHash, email]
      );

      if (result.rowCount === 0) {
        console.log(`❌ ${email} - User not found in database`);
        failures.push(`${email} (not found)`);
        failCount++;
      } else {
        console.log(`✅ ${email} - Password set successfully`);
        successCount++;
      }
    } catch (error) {
      console.log(`❌ ${email} - Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failures.push(`${email} (error)`);
      failCount++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);

  if (failures.length > 0) {
    console.log('\nFailed users:');
    failures.forEach(f => console.log(`  - ${f}`));
  }

  await pool.end();
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
