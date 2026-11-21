import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const content = await readFile(new URL('../.env', import.meta.url), 'utf8');
const env = Object.fromEntries(content.split(/\r?\n/).filter(line => line.includes('=')).map(line => { const at = line.indexOf('='); return [line.slice(0,at),line.slice(at+1).trim()]; }));
assert.equal(env.SEPAY_ACCOUNT_NUMBER, 'TEST-SEPAY', 'Phép thử chỉ dùng tài khoản giả local');
const id = Date.now();
const code = 'SS' + randomUUID().replaceAll('-','').toUpperCase();
const body = { id, accountNumber: env.SEPAY_ACCOUNT_NUMBER, gateway: env.SEPAY_GATEWAY, content: code, transferType: 'in', transferAmount: 1000 };
const sql = query => execFileSync('docker', ['exec','-i','supabase_db_nha-tro-pwa','psql','-U','postgres','-d','postgres','-tA','-v','ON_ERROR_STOP=1'], { input: query, encoding:'utf8' }).trim();
async function send(auth, payload = body) {
 return fetch('http://127.0.0.1:54321/functions/v1/sepay-webhook', { method:'POST',headers:{'Content-Type':'application/json',Authorization:auth},body:JSON.stringify(payload) });
}
try {
 assert.equal((await send('Apikey invalid')).status,401);
 for (let i=0;i<2;i++) {
  const response=await send(`Apikey ${env.SEPAY_WEBHOOK_API_KEY}`);
  assert.equal(response.status,200,await response.text());
 }
 assert.equal(sql(`SELECT count(*) FROM giao_dich_ngan_hang WHERE id=${id} AND da_phan_bo=0 AND trang_thai='can_doi_soat';`),'1');
 assert.equal((await send(`Apikey ${env.SEPAY_WEBHOOK_API_KEY}`,{...body,transferAmount:2000})).status,500);
 console.log('PASS: HTTP Edge Function → RPC → database, auth rejection, unmatched ledger, retry deduplication/conflict.');
} finally {
 sql(`DELETE FROM giao_dich_ngan_hang WHERE id=${id} AND tai_khoan='TEST-SEPAY' AND hoa_don_id IS NULL;`);
}
