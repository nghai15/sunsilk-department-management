import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPasswordRecovery } from '../../frontend/src/features/auth/passwordRecovery.ts';

function setup(overrides = {}) {
  const calls = [];
  const auth = {
    signOut: async options => { calls.push(['signOut', options]); return { error: null }; },
    signInWithOtp: async options => { calls.push(['send', options]); return { error: null }; },
    verifyOtp: async options => { calls.push(['verify', options]); return { data: { session: {}, user: { id: 'tenant' } }, error: null }; },
    getUser: async () => ({ data: { user: { id: 'tenant' } }, error: null }),
    updateUser: async options => { calls.push(['update', options]); return { error: null }; },
    ...overrides.auth,
  };
  const client = { auth, from: () => ({ select: () => ({ eq: () => ({ single: async () => overrides.profile ?? { data: { vai_tro: 'nguoi_thue', dang_hoat_dong: true }, error: null } }) }) }) };
  return { recovery: createPasswordRecovery(client), calls };
}

test('chỉ gửi OTP cho tài khoản hiện có, không tự đăng ký', async () => {
  const { recovery, calls } = setup();
  await recovery.send('84900000099');
  assert.deepEqual(calls.find(c => c[0] === 'send')[1], { phone: '84900000099', options: { shouldCreateUser: false, channel: 'sms' } });
  await assert.rejects(recovery.send('abc'));
});

test('không đổi mật khẩu trước khi OTP được xác minh', async () => {
  const { recovery, calls } = setup();
  await assert.rejects(recovery.update('New-password-123'));
  assert.equal(calls.some(c => c[0] === 'update'), false);
});

test('OTP sai không tạo phiên đổi mật khẩu', async () => {
  const { recovery, calls } = setup({ auth: { verifyOtp: async () => ({ data: {}, error: { status: 403 } }) } });
  await assert.rejects(recovery.verify('84900000099', '000000'), /OTP/);
  await assert.rejects(recovery.update('New-password-123'));
  assert.equal(calls.some(c => c[0] === 'update'), false);
});

test('chỉ tiếp tục với người thuê đang hoạt động', async () => {
  for (const data of [{ vai_tro: 'chu_tro', dang_hoat_dong: true }, { vai_tro: 'nguoi_thue', dang_hoat_dong: false }]) {
    const { recovery, calls } = setup({ profile: { data, error: null } });
    await assert.rejects(recovery.verify('84900000099', '123456'));
    await assert.rejects(recovery.update('New-password-123'));
    assert.equal(calls.some(c => c[0] === 'update'), false);
    assert.ok(calls.some(c => c[0] === 'signOut'));
  }
});

test('đổi mật khẩu thành công và đóng phiên khôi phục', async () => {
  const { recovery, calls } = setup();
  await recovery.verify('84900000099', '123456');
  await assert.rejects(recovery.update('short'));
  await recovery.update('New-password-123');
  assert.deepEqual(calls.find(c => c[0] === 'update')[1], { password: 'New-password-123' });
  assert.equal(calls.at(-1)[0], 'signOut');
  await assert.rejects(recovery.update('Another-password-123'));
});

test('OTP được yêu cầu lại sẽ hủy quyền đổi mật khẩu trước đó', async () => {
  const { recovery } = setup();
  await recovery.verify('84900000099', '123456');
  await recovery.send('84900000099');
  await assert.rejects(recovery.update('New-password-123'));
});
