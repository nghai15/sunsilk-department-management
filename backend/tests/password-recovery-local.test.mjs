import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { createPasswordRecovery } from '../../frontend/src/features/auth/passwordRecovery.ts';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const env = await readFile(new URL('../../frontend/.env', import.meta.url), 'utf8');
const value = name => env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1].trim().replace(/^["']|["']$/g, '');
const url = value('VITE_SUPABASE_URL');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(url).hostname), 'Chỉ chạy trên local');
const key = value('VITE_SUPABASE_ANON_KEY');
const makeClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: randomUUID() } });
const owner = makeClient();
const login = await owner.auth.signInWithPassword({ phone: '84901234567', password: '123456' });
assert.equal(login.error, null);
const phone = '84900000099';
const oldPassword = `Old-${randomUUID()}`;
const newPassword = `New-${randomUUID()}`;
let id;
try {
  const created = await owner.functions.invoke('manage-tenants', { body: { action: 'create', name: 'Kiểm thử OTP local', phone, password: oldPassword } });
  assert.equal(created.error, null, 'Không tạo được tài khoản thử; không thay đổi tài khoản có sẵn');
  id = created.data.id;
  const recoveryClient = makeClient();
  const recovery = createPasswordRecovery(recoveryClient);
  await assert.rejects(recovery.update(newPassword));
  await recovery.send(phone);
  await assert.rejects(recovery.verify(phone, '000000'));
  await recovery.verify(phone, '936284');
  assert.equal((await owner.auth.getUser()).data.user.id, login.data.user.id, 'Không thay phiên chủ trọ');
  await recovery.update(newPassword);
  assert.equal((await recoveryClient.auth.getSession()).data.session, null);
  const tenant = makeClient();
  assert.ok((await tenant.auth.signInWithPassword({ phone, password: oldPassword })).error);
  assert.equal((await tenant.auth.signInWithPassword({ phone, password: newPassword })).error, null);
  await tenant.auth.signOut();
  console.log('PASS: OTP sai bị chặn, OTP đúng đổi được mật khẩu, mật khẩu cũ hết hiệu lực, phiên chính không bị thay thế.');
} finally {
  if (id) {
    const deleted = await owner.functions.invoke('manage-tenants', { body: { action: 'delete', id } });
    assert.equal(deleted.error, null, `Không dọn được tài khoản thử ${id}`);
  }
  await owner.auth.signOut();
}
