import { access, writeFile } from 'node:fs/promises';
import { randomBytes, randomInt } from 'node:crypto';
try { await access('.env.local'); console.log('Local configuration already exists.'); }
catch {
  const pin = String(randomInt(100000, 1000000));
  await writeFile('.env.local', `ADMIN_PIN=${pin}\nAUTH_SECRET=${randomBytes(48).toString('hex')}\nDATABASE_URL=\nPORT=3000\n`, { mode: 0o600 });
  console.log('Private local configuration created. Your admin PIN is in .env.local. Keep this file out of Git.');
}
