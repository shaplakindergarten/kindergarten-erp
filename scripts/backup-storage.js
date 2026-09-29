const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function downloadAllBuckets() {
  console.log('⏳ স্টোরেজ ব্যাকআপ শুরু হচ্ছে...');
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) return console.error(bErr.message);

  for (const bucket of buckets) {
    const backupDir = path.join(__dirname, '../backups/storage', bucket.name);
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const { data: files } = await supabase.storage.from(bucket.name).list();
    if (!files) continue;

    for (const file of files) {
      if (file.name === '.emptyFolderPlaceholder') continue;
      const { data } = await supabase.storage.from(bucket.name).download(file.name);
      if (data) {
        fs.writeFileSync(path.join(backupDir, file.name), Buffer.from(await data.arrayBuffer()));
        console.log(`✅ ডাউনলোড: ${file.name}`);
      }
    }
  }
  console.log('🎉 স্টোরেজ ব্যাকআপ সম্পন্ন!');
}
downloadAllBuckets();