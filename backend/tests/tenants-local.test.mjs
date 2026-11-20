import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomInt, randomUUID } from 'node:crypto';

const env = await readFile(new URL('../../frontend/.env', import.meta.url), 'utf8');
const value = name => env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1].trim().replace(/^["']|["']$/g, '');
const base = value('VITE_SUPABASE_URL');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Chỉ chạy trên Supabase local');
const key = value('VITE_SUPABASE_ANON_KEY');
async function request(path, token, body, method = 'POST') {
  const response = await fetch(`${base}${path}`, { method, headers: { apikey: key, Authorization: `Bearer ${token || key}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}
async function login(phone, password = '123456') {
  const result = await request('/auth/v1/token?grant_type=password', null, { phone, password });
  assert.equal(result.status, 200, 'Đăng nhập tài khoản local');
  return result.data.access_token;
}
const owner = await login('84901234567');
const manager = await login('84911111111');
const tenant = await login('84987654321');
const admin = await login('84922222222');
const phone = `8498${randomInt(1000000, 9999999)}`;
const updatedPhone = `8497${randomInt(1000000, 9999999)}`;
const password = `Test-${randomUUID()}`;
const payload = { action: 'create', name: 'Kiểm thử người thuê', phone, password, cccd: '012345678901' };
let created;
try {
  for (const invalid of [undefined, '', '   ', '12345678901', '1234567890123', '01234567890x']) {
    assert.equal((await request('/functions/v1/manage-tenants', owner, { ...payload, cccd: invalid })).status, 400, 'Chặn thêm người thuê thiếu/sai căn cước');
  }
  for (const deniedToken of [manager, tenant]) {
    assert.equal((await request('/functions/v1/manage-tenants', deniedToken, payload)).status, 403);
  }
  const result = await request('/functions/v1/manage-tenants', owner, payload);
  assert.equal(result.status, 201, JSON.stringify(result.data));
  created = result.data.id;
  const profile = async () => (await request(`/rest/v1/nguoi_dung?id=eq.${created}&select=ho_ten,so_dien_thoai,cccd,vai_tro`, owner, null, 'GET')).data[0];
  assert.deepEqual(await profile(), { ho_ten: payload.name, so_dien_thoai: phone.replace(/^84/, '0'), cccd: payload.cccd, vai_tro: 'nguoi_thue' });
  await login(phone, password);
  assert.equal((await request('/functions/v1/manage-tenants', owner, payload)).status, 409);
  assert.equal((await request('/functions/v1/manage-tenants', admin, { action: 'update', id: created, name: 'Tên đã sửa', phone: updatedPhone, cccd: '' })).status, 400);
  assert.equal((await profile()).so_dien_thoai, phone.replace(/^84/, '0'));
  assert.equal((await request('/functions/v1/manage-tenants', admin, { action: 'update', id: created, name: 'Tên đã sửa', phone: updatedPhone, cccd: '012345678902' })).status, 200);
  assert.deepEqual(await profile(), { ho_ten: 'Tên đã sửa', so_dien_thoai: updatedPhone.replace(/^84/, '0'), cccd: '012345678902', vai_tro: 'nguoi_thue' });
  await login(updatedPhone, password);
  assert.equal((await request('/auth/v1/token?grant_type=password', null, { phone, password })).status, 400);
  assert.equal((await request('/functions/v1/manage-tenants', admin, { action: 'delete', id: created })).status, 200);
  assert.equal(await profile(), undefined);
  created = undefined;
  assert.equal((await request('/auth/v1/token?grant_type=password', null, { phone: updatedPhone, password })).status, 400);
  console.log('PASS: quyền owner/admin, chặn manager/tenant, thêm, trùng SĐT, sửa, đồng bộ đăng nhập, xóa.');
} finally {
  if (created) {
    const result = await request('/functions/v1/manage-tenants', owner, { action: 'delete', id: created });
    assert.equal(result.status, 200, `Không dọn được tài khoản thử ${created}`);
  }
}
