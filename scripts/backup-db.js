const { exec } = require('child_process');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: '.env.local' });

// ----------------------
// Configuration
// ----------------------
const dbUrl = process.env.DATABASE_URL;
const pgDumpPath =
  process.env.PG_DUMP_PATH ||
  'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe';

if (!dbUrl) {
  console.error('❌ DATABASE_URL not found in .env.local');
  process.exit(1);
}

// ----------------------
// Backup Folder
// ----------------------
const backupDir = path.join(__dirname, '../backups/database');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// ----------------------
// Backup File Name
// ----------------------
const now = new Date();

const date =
  now.getFullYear() +
  '-' +
  String(now.getMonth() + 1).padStart(2, '0') +
  '-' +
  String(now.getDate()).padStart(2, '0');

const time =
  String(now.getHours()).padStart(2, '0') +
  '-' +
  String(now.getMinutes()).padStart(2, '0') +
  '-' +
  String(now.getSeconds()).padStart(2, '0');

const backupFile = path.join(
  backupDir,
  `db_backup_${date}_${time}.sql`
);

// ----------------------
// Check pg_dump
// ----------------------
if (!fs.existsSync(pgDumpPath)) {
  console.error('❌ pg_dump.exe not found.');
  console.error('Path:', pgDumpPath);
  process.exit(1);
}

// ----------------------
// Run Backup
// ----------------------
console.log('========================================');
console.log('📦 Kindergarten ERP Database Backup');
console.log('========================================');
console.log('⏳ Starting backup...');
console.log('');

const command = `"${pgDumpPath}" --verbose --clean --if-exists --no-owner --no-privileges "${dbUrl}" > "${backupFile}"`;

exec(command, (error, stdout, stderr) => {

  if (error) {

    console.error('');
    console.error('❌ Backup Failed');
    console.error('');

    if (stderr)
      console.error(stderr);

    console.error(error.message);

    console.log('');
    console.log('Possible reasons:');
    console.log('1. Wrong DATABASE_URL');
    console.log('2. Wrong Database Password');
    console.log('3. DNS / Internet Problem');
    console.log('4. pg_dump.exe not found');
    console.log('5. Supabase database paused');
    console.log('');

    process.exit(1);
  }

  try {

    const stat = fs.statSync(backupFile);

    console.log('');
    console.log('✅ Backup Completed Successfully');
    console.log('');
    console.log('File :', backupFile);
    console.log('Size :', (stat.size / 1024).toFixed(2), 'KB');

  } catch (e) {

    console.error('❌ Backup file verification failed.');
    console.error(e.message);

  }

});