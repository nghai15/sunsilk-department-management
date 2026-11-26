import assert from 'node:assert/strict';
import { handleWebhook } from '../functions/sepay-webhook/handler.ts';
const config = { apiKey: 'local-test-secret-at-least-32-characters', account: '0123456789', bankBin: '970436', gateway: 'Vietcombank' };
const code = 'SS' + 'A'.repeat(32);
const payload = { id: 101, accountNumber: config.account, gateway: config.gateway, content: `Thanh toan ${code}`, transferType: 'in', transferAmount: 100000 };
let saved = [];
async function call(data = payload, auth = `Apikey ${config.apiKey}`, settings = config, fail = false) {
  return handleWebhook(new Request('http://localhost/webhook', { method: 'POST', headers: { Authorization: auth }, body: JSON.stringify(data) }), settings, async value => { saved.push(value); return { error: fail ? new Error('database unavailable') : null }; });
}
assert.equal((await call(payload, '')).status, 401);
assert.equal((await call(payload, 'Bearer tenant-token')).status, 401);
assert.equal((await call(payload, `Apikey ${config.apiKey}`, {})).status, 503);
assert.equal(saved.length, 0);
assert.equal((await call({ ...payload, accountNumber: 'wrong' })).status, 400);
assert.equal((await call({ ...payload, gateway: 'OtherBank' })).status, 400);
for (const transferAmount of [0, -1, 1.5, '1000', 10000000000]) assert.equal((await call({ ...payload, transferAmount })).status, 400);
assert.equal((await call({ ...payload, transferType: 'out' })).status, 200);
assert.equal(saved.length, 0);
assert.equal((await call()).status, 200);
assert.equal(saved.at(-1).p_code, code);
assert.equal((await call({ ...payload, content: 'Wrong memo', code })).status, 200);
assert.equal(saved.at(-1).p_code, '');
await call({ ...payload, content: `${code} SS${'B'.repeat(32)}` });
assert.equal(saved.at(-1).p_code, '');
assert.equal((await call(payload, `Apikey ${config.apiKey}`, config, true)).status, 500);
console.log('PASS: xác thực, cấu hình, ngân hàng, tiền vào/ra, số tiền, mã không khớp/không rõ ràng, lỗi lưu để retry.');
