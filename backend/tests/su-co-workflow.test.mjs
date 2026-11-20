import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';

// PostgreSQL trong bộ nhớ; không kết nối hay ghi vào database thật.
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ?? '@electric-sql/pglite');
const db = new PGlite();
const id = (group, n) => `f6${group}0000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ADMIN = id('00', 1), OWNER = id('00', 2), MANAGER = id('00', 3);
const TENANT_A = id('00', 4), TENANT_B = id('00', 5);
const AREA_A = id('10', 1), AREA_B = id('10', 2);
const ROOM_A = id('20', 1), ROOM_B = id('20', 2);
const ISSUE_A = id('40', 1), ISSUE_B = id('40', 2);
let legacy;

async function asUser(userId, action) {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec('SET ROLE authenticated');
  try { return await action(); }
  finally {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub', '', false)");
  }
}

async function settle(contract, day, request = null, overrides = {}) {
  const preview = (await db.query('SELECT xem_quyet_toan($1) AS value',[contract])).rows[0].value;
  return db.query("SELECT xac_nhan_quyet_toan($1,$2,'Hai bên thống nhất',$3,'tien_mat','Đã nhận cọc và bàn giao tiền thực tế',$4,true,true,$5) AS id",[contract,day,overrides.version ?? preview.version,overrides.confirm ?? true,request]);
}

async function update(issueId, state, note = null, cost = null) {
  let proof = null;
  if (state === 'hoan_tat') {
    const issue = (await db.query('SELECT phong_id,co_the_xu_ly_su_co(phong_id) AS allowed FROM su_co WHERE id=$1', [issueId])).rows[0];
    if (issue?.allowed) {
      proof = [`${issue.phong_id}/xu-ly/${issueId}/proof.jpg`];
      if (!(await db.query('SELECT id FROM storage.objects WHERE name=$1', [proof[0]])).rows.length) await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('anh-su-co',$1)", [proof[0]]);
    }
  }
  return (await db.query(
    'SELECT * FROM cap_nhat_xu_ly_su_co($1::uuid, $2::text, $3::text, $4::numeric, $5::text[])',
    [issueId, state, note, cost, proof],
  )).rows[0];
}

const rejectsCode = (promise, code) => assert.rejects(promise, (err) => err.code === code);
const getIssue = async () => (await db.query('SELECT * FROM su_co WHERE id = $1', [ISSUE_A])).rows[0];
const history = async () => (await db.query(
  'SELECT * FROM lich_su_su_co WHERE su_co_id = $1 ORDER BY tao_luc, id', [ISSUE_A],
)).rows;

before(async () => {
  // Chỉ giả lập phần tích hợp Auth/Storage. Các bảng, RLS, trigger và RPC
  // nghiệp vụ đều được tạo bằng migrations thật của dự án.
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, phone text, raw_user_meta_data jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets (
      id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
    );
    CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
      SELECT (string_to_array($1, '/'))[1:array_length(string_to_array($1, '/'), 1) - 1]
    $$;
  `);
  const dir = new URL('../migrations/', import.meta.url);
  const migrations = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  // Chạy 001–005, chèn dữ liệu cũ, rồi chạy 006 trở đi để kiểm tra đường nâng cấp.
  for (const name of migrations.filter((f) => f < '006_')) {
    await db.exec(await readFile(new URL(name, dir), 'utf8'));
  }
  for (const [i, name] of ['Quản trị', 'Chủ trọ', 'Quản lý', 'Thuê A', 'Thuê B'].entries()) {
    await db.query('INSERT INTO auth.users VALUES ($1, $2, $3)', [
      id('00', i + 1), `8490000060${i + 1}`, JSON.stringify({ ho_ten: name }),
    ]);
  }
  await db.exec(`
    UPDATE nguoi_dung SET vai_tro = 'quan_tri' WHERE id = '${ADMIN}';
    UPDATE nguoi_dung SET vai_tro = 'chu_tro' WHERE id = '${OWNER}';
    UPDATE nguoi_dung SET vai_tro = 'quan_ly' WHERE id = '${MANAGER}';
    INSERT INTO khu_tro (id, ten, dia_chi, chu_tro_id) VALUES
      ('${AREA_A}', 'Khu A', 'A', '${OWNER}'), ('${AREA_B}', 'Khu B', 'B', '${OWNER}');
    INSERT INTO nhan_su_khu_tro VALUES ('${AREA_A}', '${MANAGER}');
    INSERT INTO phong_tro (id, khu_tro_id, so_phong, gia_thue_co_ban) VALUES
      ('${ROOM_A}', '${AREA_A}', 'A101', 1000000), ('${ROOM_B}', '${AREA_B}', 'B101', 1000000);
    INSERT INTO hop_dong (phong_id, nguoi_thue_id, ngay_bat_dau, gia_thue, tien_coc) VALUES
      ('${ROOM_A}', '${TENANT_A}', CURRENT_DATE, 1000000, 0),
      ('${ROOM_B}', '${TENANT_B}', CURRENT_DATE, 1000000, 0);
    INSERT INTO su_co (id, phong_id, nguoi_thue_id, tieu_de, trang_thai, hoan_tat_luc)
      VALUES ('${ISSUE_A}', '${ROOM_A}', '${TENANT_A}', 'Dữ liệu cũ', 'hoan_tat', '2026-10-01T10:00:00Z');
  `);
  for (const name of migrations.filter((f) => f >= '006_')) {
    await db.exec(await readFile(new URL(name, dir), 'utf8'));
  }
  legacy = { issue: await getIssue(), history: await history() };
});

beforeEach(async () => {
  await db.exec('DELETE FROM phi_sua_chua; DELETE FROM su_co; DELETE FROM thong_bao');
  for (const [user, room, issue] of [[TENANT_A, ROOM_A, ISSUE_A], [TENANT_B, ROOM_B, ISSUE_B]]) {
    await asUser(user, () => db.query(
      'INSERT INTO su_co (id, phong_id, tieu_de, mo_ta) VALUES ($1, $2, $3, $4)',
      [issue, room, 'Máy lạnh không mát', 'Cần kiểm tra'],
    ));
  }
});

after(async () => { await db.close(); });

test('migration 006 giữ nguyên sự cố và lịch sử cũ', () => {
  assert.equal(legacy.issue.trang_thai, 'hoan_tat');
  assert.equal(legacy.issue.hoan_tat_luc.toISOString(), '2026-10-01T10:00:00.000Z');
  assert.equal(legacy.issue.ghi_chu_xu_ly, null);
  assert.equal(legacy.history.length, 1);
  assert.equal(legacy.history[0].chi_phi_sua_chua, null);
});

test('quản lý nhận báo cáo và chỉ xem/xử lý sự cố trong khu được giao', async () => {
  await asUser(MANAGER, async () => {
    assert.deepEqual((await db.query('SELECT id FROM su_co')).rows.map((r) => r.id), [ISSUE_A]);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM thong_bao')).rows[0].n, 1);
    await rejectsCode(update(ISSUE_B, 'dang_xu_ly'), '42501');
    assert.equal((await db.query("UPDATE su_co SET trang_thai = 'dang_xu_ly' WHERE id = $1 RETURNING id", [ISSUE_B])).rows.length, 0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM lich_su_su_co WHERE su_co_id = $1', [ISSUE_B])).rows[0].n, 0);
  });
});

test('chưa thể xử lý phải có lý do, kể cả UPDATE bảng trực tiếp', async () => {
  await asUser(MANAGER, async () => {
    for (const note of [null, '', '   ', '\t\n\r ']) {
      await rejectsCode(update(ISSUE_A, 'chua_the_xu_ly', note), '22023');
    }
    await rejectsCode(db.query(
      "UPDATE su_co SET trang_thai = 'chua_the_xu_ly', ghi_chu_xu_ly = NULL WHERE id = $1", [ISSUE_A],
    ), '23514');
    await rejectsCode(db.query(
      "UPDATE su_co SET trang_thai = 'chua_the_xu_ly', ghi_chu_xu_ly = E'\\t\\n' WHERE id = $1", [ISSUE_A],
    ), '23514');
  });
  assert.equal((await getIssue()).trang_thai, 'cho_tiep_nhan');
  assert.equal((await history()).length, 1);
});

test('cập nhật trạng thái lưu lý do, người thực hiện, thời gian và thông báo người thuê', async () => {
  await asUser(MANAGER, async () => {
    const issue = await update(ISSUE_A, 'chua_the_xu_ly', '  Chờ linh kiện  ');
    assert.equal(issue.ghi_chu_xu_ly, 'Chờ linh kiện');
  });
  const log = (await history()).find((r) => r.den_trang_thai === 'chua_the_xu_ly');
  assert.equal(log.nguoi_thuc_hien_id, MANAGER);
  assert.equal(log.ghi_chu, 'Chờ linh kiện');
  assert.ok(log.tao_luc);
  await asUser(TENANT_A, async () => {
    const notification = (await db.query("SELECT * FROM thong_bao WHERE loai = 'su_co'")).rows[0];
    assert.equal(notification.tieu_de, 'Sự cố: Chưa thể xử lý');
    assert.match(notification.noi_dung, /Chờ linh kiện/);
    assert.equal(notification.du_lieu.trang_thai, 'chua_the_xu_ly');
  });
});

test('tiếp tục xử lý, hoàn tất, lưu chi phí và mở lại sự cố', async () => {
  await asUser(MANAGER, async () => {
    await update(ISSUE_A, 'chua_the_xu_ly', 'Chờ linh kiện');
    const processing = await update(ISSUE_A, 'dang_xu_ly', 'Đã có linh kiện');
    assert.equal(processing.hoan_tat_luc, null);
    const done = await update(ISSUE_A, 'hoan_tat', 'Đã thay linh kiện', 350000);
    assert.ok(done.hoan_tat_luc);
    assert.equal(Number(done.chi_phi_sua_chua), 350000);
    assert.equal((await update(ISSUE_A, 'hoan_tat', 'Đã thay linh kiện')).hoan_tat_luc.getTime(), done.hoan_tat_luc.getTime());
    const reopened = await update(ISSUE_A, 'dang_xu_ly', 'Cần kiểm tra thêm');
    assert.equal(reopened.hoan_tat_luc, null);
  });
  const logs = await history();
  assert.equal(logs.length, 5); // tạo + 4 lần cập nhật thật, không ghi trùng lần giữ nguyên
  assert.equal(Number(logs.find((r) => r.den_trang_thai === 'hoan_tat').chi_phi_sua_chua), 350000);
  assert.ok(logs.some((r) => r.ghi_chu === 'Chờ linh kiện'));
  await asUser(TENANT_A, async () => {
    assert.equal((await db.query("SELECT count(*)::int AS n FROM thong_bao WHERE tieu_de = 'Sự cố: Đã xử lý'")).rows[0].n, 1);
  });
});

test('ghi chú hoặc chi phí thay đổi cùng trạng thái vẫn lưu lịch sử, không gửi push lặp', async () => {
  await asUser(MANAGER, async () => {
    await update(ISSUE_A, 'dang_xu_ly', 'Đã liên hệ thợ');
    await update(ISSUE_A, 'dang_xu_ly', 'Thợ đang đến', 100000);
  });
  assert.equal((await history()).length, 3);
  await asUser(TENANT_A, async () => {
    assert.equal((await db.query('SELECT count(*)::int AS n FROM thong_bao')).rows[0].n, 1);
  });
});

test('người thuê không được tự xử lý hoặc sửa ghi chú, chi phí và thời điểm hoàn tất', async () => {
  await asUser(TENANT_A, async () => {
    await rejectsCode(update(ISSUE_A, 'hoan_tat', 'Tự xác nhận'), '42501');
    await rejectsCode(db.query("UPDATE su_co SET trang_thai = 'hoan_tat' WHERE id = $1", [ISSUE_A]), '42501');
    for (const sql of [
      "UPDATE su_co SET ghi_chu_xu_ly = 'Giả ghi chú' WHERE id = $1",
      'UPDATE su_co SET chi_phi_sua_chua = 1000 WHERE id = $1',
      'UPDATE su_co SET hoan_tat_luc = NOW() WHERE id = $1',
    ]) await rejectsCode(db.query(sql, [ISSUE_A]), '42501');
  });
});

test('người thuê không thể chèn thông tin xử lý ngay lúc gửi báo cáo', async () => {
  await asUser(TENANT_A, async () => {
    for (const sql of [
      "INSERT INTO su_co (phong_id, tieu_de, ghi_chu_xu_ly) VALUES ($1, 'Báo cáo mới', 'Giả ghi chú')",
      "INSERT INTO su_co (phong_id, tieu_de, chi_phi_sua_chua) VALUES ($1, 'Báo cáo mới', 1000)",
      "INSERT INTO su_co (phong_id, tieu_de, hoan_tat_luc) VALUES ($1, 'Báo cáo mới', NOW())",
    ]) await rejectsCode(db.query(sql, [ROOM_A]), '42501');
  });
});

test('người thuê sửa nội dung/hủy khi còn chờ; không sửa sau khi quản lý tiếp nhận', async () => {
  await asUser(TENANT_A, async () => {
    await db.query("UPDATE su_co SET mo_ta = 'Bổ sung ảnh' WHERE id = $1", [ISSUE_A]);
    assert.equal((await db.query("UPDATE su_co SET trang_thai = 'da_huy' WHERE id = $1 RETURNING id", [ISSUE_A])).rows.length, 1);
  });
  await asUser(MANAGER, () => update(ISSUE_A, 'dang_xu_ly', 'Kiểm tra lại theo yêu cầu'));
  await asUser(TENANT_A, async () => {
    assert.equal((await db.query("UPDATE su_co SET trang_thai = 'da_huy' WHERE id = $1 RETURNING id", [ISSUE_A])).rows.length, 0);
  });
});

test('dashboard và danh sách phòng tính chưa thể xử lý là sự cố còn mở', async () => {
  await asUser(MANAGER, async () => {
    await update(ISSUE_A, 'chua_the_xu_ly', 'Chờ thợ');
    const dashboard = (await db.query('SELECT tong_quan_dashboard($1) AS value', [AREA_A])).rows[0].value;
    assert.equal(dashboard.so_su_co_dang_mo, 1);
    const room = (await db.query('SELECT * FROM tong_quan_phong WHERE id = $1', [ROOM_A])).rows[0];
    assert.equal(Number(room.so_su_co_dang_mo), 1);
    assert.equal(room.trang_thai_hien_thi, 'co_su_co');
    await rejectsCode(db.query('SELECT tong_quan_dashboard($1)', [AREA_B]), '42501');
    await update(ISSUE_A, 'hoan_tat', 'Đã sửa');
    assert.equal((await db.query('SELECT tong_quan_dashboard($1) AS value', [AREA_A])).rows[0].value.so_su_co_dang_mo, 0);
    assert.equal((await db.query('SELECT trang_thai_hien_thi FROM tong_quan_phong WHERE id = $1', [ROOM_A])).rows[0].trang_thai_hien_thi, 'dang_thue');
  });
});

test('chủ trọ can thiệp, quản trị chỉ xem sự cố', async () => {
  for (const user of [OWNER, ADMIN]) {
    await asUser(user, async () => {
      assert.equal((await db.query('SELECT count(*)::int AS n FROM su_co')).rows[0].n, 2);
      if (user === OWNER) {
        assert.equal((await update(ISSUE_B, 'dang_xu_ly', `Giám sát ${user}`)).trang_thai, 'dang_xu_ly');
      } else {
        await rejectsCode(update(ISSUE_B, 'hoan_tat'), '42501');
        assert.equal((await db.query("UPDATE su_co SET trang_thai = 'hoan_tat' WHERE id = $1 RETURNING id", [ISSUE_B])).rows.length, 0);
        assert.equal((await db.query('DELETE FROM su_co WHERE id = $1 RETURNING id', [ISSUE_B])).rows.length, 0);
        await rejectsCode(db.query('INSERT INTO su_co (phong_id, tieu_de) VALUES ($1, $2)', [ROOM_A, 'Không được tạo']), '42501');
      }
    });
  }
});

test('phân quyền: quản trị không tự nâng quyền, không sửa/xóa chủ trọ', async () => {
  await asUser(ADMIN, async () => {
    await rejectsCode(db.query("UPDATE nguoi_dung SET vai_tro = 'chu_tro' WHERE id = $1", [ADMIN]), '42501');
    assert.equal((await db.query("UPDATE nguoi_dung SET dang_hoat_dong = false WHERE id = $1 RETURNING id", [OWNER])).rows.length, 0);
    assert.equal((await db.query('DELETE FROM nguoi_dung WHERE id = $1 RETURNING id', [OWNER])).rows.length, 0);
    await rejectsCode(db.query("UPDATE nguoi_dung SET vai_tro = 'quan_tri' WHERE id = $1", [MANAGER]), '42501');
    await rejectsCode(db.query('UPDATE khu_tro SET chu_tro_id = NULL WHERE id = $1', [AREA_A]), '42501');
  });
});

test('phân quyền: quản trị quản lý tài khoản cấp dưới và phân công khu', async () => {
  await asUser(ADMIN, async () => {
    await db.exec('BEGIN');
    try {
      assert.equal((await db.query("UPDATE nguoi_dung SET vai_tro = 'quan_ly' WHERE id = $1 RETURNING vai_tro", [TENANT_B])).rows[0].vai_tro, 'quan_ly');
      await db.query('INSERT INTO nhan_su_khu_tro VALUES ($1, $2)', [AREA_B, MANAGER]);
      assert.equal((await db.query('SELECT la_nhan_su_khu_tro($1) AS ok', [AREA_B])).rows[0].ok, true);
    } finally { await db.exec('ROLLBACK'); }
  });
});

test('phân quyền: chủ trọ có quyền cao nhất kể cả khu không đứng tên', async () => {
  await db.exec('BEGIN');
  try {
    await db.query('UPDATE khu_tro SET chu_tro_id = NULL WHERE id = $1', [AREA_B]);
    await asUser(OWNER, async () => {
      assert.equal((await db.query('SELECT la_nhan_su_khu_tro($1) AS ok', [AREA_B])).rows[0].ok, true);
      assert.equal((await update(ISSUE_B, 'hoan_tat')).trang_thai, 'hoan_tat');
      assert.equal((await db.query("UPDATE nguoi_dung SET vai_tro = 'quan_ly' WHERE id = $1 RETURNING vai_tro", [ADMIN])).rows[0].vai_tro, 'quan_ly');
    });
  } finally { await db.exec('ROLLBACK'); }
});

test('phân quyền: quản lý/người thuê không tự nâng quyền hoặc phân công khu', async () => {
  for (const user of [MANAGER, TENANT_A]) {
    await asUser(user, async () => {
      await rejectsCode(db.query("UPDATE nguoi_dung SET vai_tro = 'chu_tro' WHERE id = $1", [user]), '42501');
      await rejectsCode(db.query('INSERT INTO nhan_su_khu_tro VALUES ($1, $2)', [AREA_B, user]), '42501');
    });
  }
});

test('phân quyền: chỉ quản lý được giao khu và chủ trọ nhận thông báo complain', async () => {
  await db.exec('BEGIN');
  try {
    await db.query('INSERT INTO nhan_su_khu_tro VALUES ($1, $2)', [AREA_A, ADMIN]);
    await db.exec('DELETE FROM thong_bao');
    await asUser(TENANT_A, () => db.query('INSERT INTO su_co (phong_id, tieu_de) VALUES ($1, $2)', [ROOM_A, 'Báo mới']));
    const recipients = (await db.query("SELECT nguoi_nhan_id FROM thong_bao WHERE loai = 'su_co'")).rows.map((r) => r.nguoi_nhan_id).sort();
    assert.deepEqual(recipients, [OWNER, MANAGER].sort());
  } finally { await db.exec('ROLLBACK'); }
});

test('phân quyền: quản trị chỉ đọc ảnh sự cố, quản lý đúng khu được xóa', async () => {
  await db.exec('BEGIN');
  try {
    const path = `${ROOM_A}/complain.jpg`;
    await asUser(TENANT_A, () => db.query("INSERT INTO storage.objects (bucket_id, name) VALUES ('anh-su-co', $1)", [path]));
    await asUser(ADMIN, async () => {
      assert.equal((await db.query('SELECT * FROM storage.objects WHERE name = $1', [path])).rows.length, 1);
      await db.exec('SAVEPOINT denied_upload');
      await rejectsCode(db.query("INSERT INTO storage.objects (bucket_id, name) VALUES ('anh-su-co', $1)", [`${ROOM_A}/admin.jpg`]), '42501');
      await db.exec('ROLLBACK TO SAVEPOINT denied_upload');
    });
  } finally { await db.exec('ROLLBACK'); }
  await db.exec('BEGIN');
  try {
    const path = `${ROOM_A}/complain.jpg`;
    await db.query("INSERT INTO storage.objects (bucket_id, name) VALUES ('anh-su-co', $1)", [path]);
    await asUser(ADMIN, async () => {
      assert.equal((await db.query('DELETE FROM storage.objects WHERE name = $1 RETURNING id', [path])).rows.length, 0);
    });
    await asUser(MANAGER, async () => {
      assert.equal((await db.query('DELETE FROM storage.objects WHERE name = $1 RETURNING id', [path])).rows.length, 1);
    });
  } finally { await db.exec('ROLLBACK'); }
});

test('phân quyền: tài khoản quản lý bị khóa không còn quyền xử lý', async () => {
  await db.query('UPDATE nguoi_dung SET dang_hoat_dong = false WHERE id = $1', [MANAGER]);
  try {
    await asUser(MANAGER, () => rejectsCode(update(ISSUE_A, 'hoan_tat'), '42501'));
  } finally {
    await db.query('UPDATE nguoi_dung SET dang_hoat_dong = true WHERE id = $1', [MANAGER]);
  }
});

test('người thuê khác không xem được báo cáo/lịch sử và không tự thêm lịch sử', async () => {
  await asUser(TENANT_B, async () => {
    assert.equal((await db.query('SELECT * FROM su_co WHERE id = $1', [ISSUE_A])).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM lich_su_su_co WHERE su_co_id = $1', [ISSUE_A])).rows.length, 0);
  });
  await asUser(TENANT_A, async () => {
    await rejectsCode(db.query("INSERT INTO lich_su_su_co (su_co_id, den_trang_thai) VALUES ($1, 'hoan_tat')", [ISSUE_A]), '42501');
  });
});

test('RPC từ chối trạng thái sai, chi phí âm; anon không được gọi hoặc đọc bảng', async () => {
  await asUser(MANAGER, async () => {
    for (const state of [null, 'sai_trang_thai', 'cho_tiep_nhan']) {
      await rejectsCode(update(ISSUE_A, state), '22023');
    }
    await rejectsCode(update(ISSUE_A, 'dang_xu_ly', null, -1), '22023');
  });
  await db.exec('SET ROLE anon');
  try {
    await rejectsCode(update(ISSUE_A, 'hoan_tat'), '42501');
    await rejectsCode(db.query('SELECT * FROM su_co'), '42501');
  } finally { await db.exec('RESET ROLE'); }
});

test('006: giữ ghi chú khi chỉ đổi chi phí; đổi trạng thái mà không ghi chú thì xóa ghi chú cũ', async () => {
  await asUser(MANAGER, async () => {
    await update(ISSUE_A, 'dang_xu_ly', 'Đã liên hệ thợ');
    assert.equal((await update(ISSUE_A, 'dang_xu_ly', null, 50000)).ghi_chu_xu_ly, 'Đã liên hệ thợ');
    assert.equal((await update(ISSUE_A, 'hoan_tat')).ghi_chu_xu_ly, null);
  });
});

test('006: gọi lại cùng trạng thái, không đổi gì thì không ghi lịch sử rỗng', async () => {
  await asUser(MANAGER, async () => {
    await update(ISSUE_A, 'dang_xu_ly', 'Đã liên hệ thợ');
    await update(ISSUE_A, 'dang_xu_ly');
  });
  assert.equal((await history()).length, 2);
});

test('006: chủ trọ nhận thông báo khi có sự cố mới, link /issues/<id>', async () => {
  await asUser(OWNER, async () => {
    const rows = (await db.query("SELECT duong_dan FROM thong_bao WHERE loai = 'su_co'")).rows;
    assert.ok(rows.some((r) => r.duong_dan === `/issues/${ISSUE_A}`));
  });
  await asUser(TENANT_B, async () => {
    assert.equal((await db.query("SELECT count(*)::int AS n FROM thong_bao WHERE duong_dan = $1", [`/issues/${ISSUE_A}`])).rows[0].n, 0);
  });
});

test('006: chỉ sửa chi phí khi đang Chưa thể xử lý thì giữ lý do cũ, không bắt nhập lại', async () => {
  await asUser(MANAGER, async () => {
    await update(ISSUE_A, 'chua_the_xu_ly', 'Chờ linh kiện');
    const row = await update(ISSUE_A, 'chua_the_xu_ly', null, 120000);
    assert.equal(row.ghi_chu_xu_ly, 'Chờ linh kiện');
    assert.equal(Number(row.chi_phi_sua_chua), 120000);
    // đổi sang Chưa thể xử lý từ trạng thái khác mà không có lý do vẫn bị từ chối
    await update(ISSUE_A, 'dang_xu_ly', 'Đã có linh kiện');
    await rejectsCode(update(ISSUE_A, 'chua_the_xu_ly'), '22023');
  });
});

test('006: quản lý tự tạo báo cáo thì không tự nhận thông báo', async () => {
  const issue = id('40', 9);
  await asUser(MANAGER, () => db.query(
    'INSERT INTO su_co (id, phong_id, tieu_de) VALUES ($1, $2, $3)', [issue, ROOM_A, 'Quản lý tự báo'],
  ));
  await asUser(MANAGER, async () => {
    assert.equal((await db.query('SELECT count(*)::int AS n FROM thong_bao WHERE duong_dan = $1', [`/issues/${issue}`])).rows[0].n, 0);
  });
  await asUser(OWNER, async () => {
    assert.equal((await db.query('SELECT count(*)::int AS n FROM thong_bao WHERE duong_dan = $1', [`/issues/${issue}`])).rows[0].n, 1);
  });
});

test('006: đổi trạng thái không gửi trùng và không tự báo cho người thao tác', async () => {
  const count = (user, issue) => asUser(user, async () => (await db.query(
    'SELECT count(*)::int AS n FROM thong_bao WHERE duong_dan = $1', [`/issues/${issue}`])).rows[0].n);
  // Chủ trọ tự tạo, quản lý cập nhật: chủ trọ chỉ nhận 1 thông báo đổi trạng thái
  const a = id('40', 7);
  await asUser(OWNER, () => db.query('INSERT INTO su_co (id, phong_id, tieu_de) VALUES ($1, $2, $3)', [a, ROOM_A, 'Chủ tự báo']));
  await asUser(MANAGER, () => update(a, 'dang_xu_ly', 'Đã nhận'));
  assert.equal(await count(OWNER, a), 1);
  // Quản lý tự tạo rồi tự cập nhật: không tự nhận thông báo nào
  const b = id('40', 8);
  await asUser(MANAGER, () => db.query('INSERT INTO su_co (id, phong_id, tieu_de) VALUES ($1, $2, $3)', [b, ROOM_A, 'QL tự báo']));
  await asUser(MANAGER, () => update(b, 'hoan_tat', 'Xong'));
  assert.equal(await count(MANAGER, b), 0);
  assert.equal(await count(OWNER, b), 2);
});


test('vận hành: tạo hợp đồng nguyên tử, chuẩn bị chỉ số, dịch vụ và kết thúc trả phòng', async () => {
  await db.exec('BEGIN');
  try {
    const room = 'af000000-0000-4000-8000-000000000011';
    const service = 'af000000-0000-4000-8000-000000000012';
    const newTenant = 'af000000-0000-4000-8000-000000000013';
    await db.query("INSERT INTO auth.users(id,phone,raw_user_meta_data) VALUES($1,'84989990013',$2)", [newTenant, JSON.stringify({ho_ten:'Khách hợp đồng thử'})]);
    const date = (await db.query("SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS d")).rows[0].d;
    await db.query("INSERT INTO phong_tro(id,khu_tro_id,so_phong,gia_thue_co_ban) VALUES($1,$2,'TEST-CONTRACT',1200000)",[room,AREA_A]);
    await db.query("INSERT INTO phi_dich_vu(id,khu_tro_id,ten,so_tien) VALUES($1,$2,'Test service',50000)",[service,AREA_A]);
    const payload = {phong_id:room,nguoi_thue_id:newTenant,ngay_bat_dau:date,gia_thue:1200000,tien_coc:500000,so_nguoi_o:1,ngay_thanh_toan:5,dien_ban_dau:100,nuoc_ban_dau:10,dich_vu:[{id:service,so_luong:1}]};
    const call = p => db.query('SELECT tao_hop_dong_day_du($1) AS id',[JSON.stringify(p)]);
    const denied = async (fn, code) => { await db.exec('SAVEPOINT operation_denied'); try { await rejectsCode(fn(),code); } finally { await db.exec('ROLLBACK TO SAVEPOINT operation_denied'); } };
    for(const actor of [TENANT_A,MANAGER]) await asUser(actor,()=>denied(()=>call(payload),'42501'));
    await asUser(OWNER, async () => {
      await denied(()=>call({...payload,nguoi_thue_id:TENANT_A}),'22023');
      await denied(()=>call({...payload,dich_vu:[{id:ROOM_B,so_luong:1}]}),'22023');
      assert.equal((await db.query('SELECT id FROM hop_dong WHERE phong_id=$1',[room])).rows.length,0);
      assert.equal((await db.query('SELECT trang_thai FROM phong_tro WHERE id=$1',[room])).rows[0].trang_thai,'trong');
      const id=(await call(payload)).rows[0].id;
      assert.equal((await db.query('SELECT id FROM chi_so_cong_to WHERE phong_id=$1',[room])).rows.length,2);
      assert.equal((await db.query('SELECT * FROM dich_vu_hop_dong WHERE hop_dong_id=$1',[id])).rows.length,1);
      assert.equal((await db.query('SELECT trang_thai FROM phong_tro WHERE id=$1',[room])).rows[0].trang_thai,'dang_thue');
      await denied(()=>call(payload),'22023');
      await denied(()=>db.query('DELETE FROM phi_dich_vu WHERE id=$1',[service]),'23503');
      await denied(()=>db.query('SELECT ket_thuc_hop_dong($1,$2,\'\')',[id,date]),'22023');
      await settle(id,date);
      assert.equal((await db.query('SELECT trang_thai FROM phong_tro WHERE id=$1',[room])).rows[0].trang_thai,'trong');
      await denied(()=>db.query('DELETE FROM phong_tro WHERE id=$1',[room]),'23503');
    });
  } finally { await db.exec('ROLLBACK'); }
});

test('người thuê: đồng bộ Auth và không xóa hồ sơ có lịch sử liên quan', async () => {
  await db.exec('BEGIN');
  try {
    const tempId = 'af000000-0000-4000-8000-000000000001';
    await db.query("INSERT INTO auth.users(id,phone,raw_user_meta_data) VALUES($1,'84989990001',$2)", [tempId, JSON.stringify({ho_ten:'Khách thử',cccd:'012345678901'})]);
    assert.equal((await db.query('SELECT cccd FROM nguoi_dung WHERE id=$1',[tempId])).rows[0].cccd,'012345678901');
    await db.query("UPDATE auth.users SET phone='84989990002',raw_user_meta_data=$2 WHERE id=$1",[tempId,JSON.stringify({ho_ten:'Tên mới',cccd:''})]);
    assert.deepEqual((await db.query('SELECT ho_ten,so_dien_thoai,cccd,vai_tro FROM nguoi_dung WHERE id=$1',[tempId])).rows[0],{ho_ten:'Tên mới',so_dien_thoai:'0989990002',cccd:null,vai_tro:'nguoi_thue'});
    await db.query('UPDATE su_co SET nguoi_thue_id=$1 WHERE id=$2',[tempId,ISSUE_A]);
    await db.exec('SAVEPOINT cannot_delete');
    await rejectsCode(db.query('DELETE FROM auth.users WHERE id=$1',[tempId]),'23503');
    await db.exec('ROLLBACK TO SAVEPOINT cannot_delete');
    assert.equal((await db.query('SELECT nguoi_thue_id FROM su_co WHERE id=$1',[ISSUE_A])).rows[0].nguoi_thue_id,tempId);
  } finally { await db.exec('ROLLBACK'); }
});

test('billing: chỉ số → tạm tính → kiểm tra → phát hành → thanh toán, khóa giá và phân quyền', async () => {
  await db.exec('BEGIN');
  try {
    const { rows: [dates] } = await db.query("SELECT date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS ky, (date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') - interval '1 month')::date::text AS truoc");
    const { rows: [contract] } = await db.query('SELECT id FROM hop_dong WHERE phong_id = $1', [ROOM_A]);
    await db.query("INSERT INTO mo_nhap_cong_to(hop_dong_id,ky,den_luc,ly_do,nguoi_mo_id) VALUES($1,$2,now()+interval '1 hour','Cửa sổ kiểm thử', $3)",[contract.id,dates.ky,MANAGER]);
    await db.query("INSERT INTO chi_so_cong_to(phong_id,loai,ky,chi_so_cu,chi_so_moi) VALUES ($1,'dien',$2,100,200),($1,'nuoc',$2,10,20)", [ROOM_A, dates.truoc]);
    const paths = [`${ROOM_A}/${TENANT_A}/dien.jpg`, `${ROOM_A}/${TENANT_A}/nuoc.jpg`];
    const call = (electricity = 250) => db.query('SELECT * FROM nguoi_thue_lap_hoa_don($1,$2,$3,25,$4,$5,now(),now())', [contract.id, dates.ky, electricity, ...paths]);
    const denied = async (action, code) => {
      await db.exec('SAVEPOINT denied');
      try { await rejectsCode(action(), code); }
      finally { await db.exec('ROLLBACK TO SAVEPOINT denied'); }
    };
    let invoiceId;
    await asUser(TENANT_B, () => denied(call, '42501'));
    await asUser(TENANT_A, async () => {
      await denied(call, '22023');
      for (const path of paths) await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('anh-cong-to',$1)", [path]);
      await denied(() => call(199), '22023');
      await denied(() => db.query('SELECT tao_hoa_don_noi_bo($1,$2)', [contract.id, dates.ky]), '42501');
      await denied(() => db.query('SELECT tao_hoa_don($1,$2)', [contract.id, dates.ky]), '42501');
      const bill = (await call()).rows[0];
      assert.equal(Number(bill.tien_dien), 50 * 3500);
      assert.equal(Number(bill.tien_nuoc), 5 * 20000);
      assert.equal(Number(bill.tong_tien), 1000000 + 50 * 3500 + 5 * 20000);
      assert.equal(bill.la_ban_nhap, true);
      invoiceId = bill.id;
      await denied(() => db.query("INSERT INTO thanh_toan(hoa_don_id,so_tien,nguoi_gui_id) VALUES($1,1000,$2)",[bill.id,TENANT_A]), "42501");
      await denied(() => db.query("SELECT phat_hanh_hoa_don($1)",[bill.id]), "42501");
      assert.equal((await db.query('SELECT id FROM hoa_don WHERE id=$1', [bill.id])).rows.length, 1);
      await denied(call, '22023');
    });
    await asUser(TENANT_B, async () => {
      assert.equal((await db.query('SELECT id FROM hoa_don WHERE id=$1',[invoiceId])).rows.length,0);
    });
    await asUser(MANAGER, async () => {
      await denied(() => db.query('SELECT kiem_tra_hoa_don($1,251,25,NULL,true)',[invoiceId]),'22023');
      await db.query("SELECT kiem_tra_hoa_don($1,250,25,'Ảnh chưa rõ',false)",[invoiceId]);
      await denied(() => db.query("SELECT kiem_tra_hoa_don($1,251,25,'Đối chiếu mặt số',true)",[invoiceId]),'22023');
      await denied(() => db.query('SELECT phat_hanh_hoa_don($1)',[invoiceId]),'22023');
    });
    await asUser(TENANT_B, () => denied(call, '42501'));
    await asUser(TENANT_A, async () => {
      assert.ok((await db.query("SELECT id FROM thong_bao WHERE nguoi_nhan_id=$1 AND noi_dung='Ảnh chưa rõ'",[TENANT_A])).rows.length);
      await denied(call,'22023');
      paths[0] = `${ROOM_A}/${TENANT_A}/dien-moi.jpg`;
      await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('anh-cong-to',$1)",[paths[0]]);
      await denied(call,'22023');
      paths[1] = `${ROOM_A}/${TENANT_A}/nuoc-moi.jpg`;
      await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('anh-cong-to',$1)",[paths[1]]);
      await denied(() => db.query("SELECT nguoi_thue_lap_hoa_don($1,$2,250,25,$3,$4,now()-interval '1 hour',now())",[contract.id,dates.ky,...paths]),'22023');
      const resent = (await call()).rows[0];
      assert.equal(resent.id,invoiceId);
      assert.equal(resent.la_ban_nhap,true);
      assert.equal(resent.ghi_chu_kiem_tra,null);
      await denied(call,'22023');
    });
    await asUser(MANAGER, async () => {
      const corrected = (await db.query("SELECT * FROM kiem_tra_hoa_don($1,251,25,'Đối chiếu mặt số',true)",[invoiceId])).rows[0];
      assert.equal(corrected.la_ban_nhap,false);
      assert.equal(Number(corrected.tien_dien),51*3500);
      await denied(() => db.query('UPDATE hoa_don SET tong_tien=1 WHERE id=$1',[invoiceId]),'42501');
      await denied(() => db.query('UPDATE chi_tiet_hoa_don SET don_gia=1 WHERE hoa_don_id=$1',[invoiceId]),'42501');
      assert.ok((await db.query('SELECT id FROM nhat_ky_hoa_don WHERE hoa_don_id=$1',[invoiceId])).rows.length>=3);
    });
    const next = (await db.query("SELECT (date_trunc('month',now() AT TIME ZONE 'Asia/Ho_Chi_Minh')+interval '1 month')::date::text AS ky")).rows[0].ky;
    for(const role of [TENANT_A,MANAGER]) await asUser(role, () => denied(() => db.query("SELECT dat_don_gia('dien',$1,$2,4000,'Giá mới')",[AREA_A,next]),'42501'));
    await asUser(ADMIN, async () => {
      await denied(() => db.query("SELECT dat_don_gia('dien',$1,$2,4000,'Giá mới')",[AREA_A,dates.ky]),'22023');
      await db.query("SELECT dat_don_gia('dien',$1,$2,4000,'Giá mới')",[AREA_A,next]);
      const current=(await db.query('SELECT gia_hop_dong($1,$2) AS gia',[contract.id,dates.ky])).rows[0].gia;
      const future=(await db.query('SELECT gia_hop_dong($1,$2) AS gia',[contract.id,next])).rows[0].gia;
      assert.equal(current.electricityRate,3500); assert.equal(future.electricityRate,4000);
      await denied(() => db.query('UPDATE khu_tro SET don_gia_dien=5000 WHERE id=$1',[AREA_A]),'42501');
      assert.equal(Number((await db.query('SELECT tien_dien FROM hoa_don WHERE id=$1',[invoiceId])).rows[0].tien_dien),51*3500);
    });
    let paymentId;
    await asUser(TENANT_A, async () => {
      paymentId=(await db.query("INSERT INTO thanh_toan(hoa_don_id,so_tien,nguoi_gui_id) VALUES($1,1000,$2) RETURNING id",[invoiceId,TENANT_A])).rows[0].id;
    });
    await asUser(ADMIN, async () => {
      await db.query("UPDATE thanh_toan SET trang_thai='da_duyet' WHERE id=$1",[paymentId]);
      assert.equal((await db.query('SELECT trang_thai_thanh_toan FROM hoa_don WHERE id=$1',[invoiceId])).rows[0].trang_thai_thanh_toan,'thanh_toan_mot_phan');
    });
  } finally { await db.exec('ROLLBACK'); }
});

test('hợp đồng: mỗi người thuê chỉ có một hợp đồng hiệu lực, vẫn giữ lịch sử', async () => {
  await db.exec('BEGIN');
  try {
    const room = 'af000000-0000-4000-8000-000000000021';
    await db.query("INSERT INTO phong_tro(id,khu_tro_id,so_phong,gia_thue_co_ban) VALUES($1,$2,'UNIQUE-TEST',1000000)", [room,AREA_A]);
    const create = () => db.query('INSERT INTO hop_dong(phong_id,nguoi_thue_id,ngay_bat_dau,gia_thue,tien_coc) VALUES($1,$2,CURRENT_DATE,1000000,0)',[room,TENANT_A]);
    await db.exec('SAVEPOINT duplicate_contract');
    await rejectsCode(create(), '23505');
    await db.exec('ROLLBACK TO SAVEPOINT duplicate_contract');
    await rejectsCode(db.query('UPDATE hop_dong SET nguoi_thue_id=$1 WHERE nguoi_thue_id=$2 AND trang_thai=\'hieu_luc\'',[TENANT_A,TENANT_B]), '23505');
    await db.exec('ROLLBACK TO SAVEPOINT duplicate_contract');
    await db.query("UPDATE hop_dong SET trang_thai='cham_dut' WHERE nguoi_thue_id=$1",[TENANT_A]);
    await create();
    const counts=(await db.query("SELECT count(*)::int total,count(*) FILTER(WHERE trang_thai='hieu_luc')::int active FROM hop_dong WHERE nguoi_thue_id=$1",[TENANT_A])).rows[0];
    assert.deepEqual(counts,{total:2,active:1});
  } finally { await db.exec('ROLLBACK'); }
});


test('hợp đồng: ngày hết hạn, ảnh gốc riêng tư, yêu cầu và quyền gia hạn/chấm dứt', async () => {
  const tenant=id('00',91), room=id('20',91);
  await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[tenant,'84900000991',JSON.stringify({ho_ten:'Thuê thử hợp đồng'})]);
  await db.query('INSERT INTO phong_tro(id,khu_tro_id,so_phong,gia_thue_co_ban) VALUES($1,$2,$3,1000000)',[room,AREA_A,'HD91']);
  const day=(await db.query('SELECT CURRENT_DATE AS day')).rows[0].day;
  const contract=(await asUser(OWNER,()=>db.query('SELECT tao_hop_dong_day_du($1::jsonb) AS id',[JSON.stringify({ phong_id:room,nguoi_thue_id:tenant,ngay_bat_dau:day,gia_thue:1000000,tien_coc:0,ngay_thanh_toan:5,so_nguoi_o:1,dien_ban_dau:0,nuoc_ban_dau:0 })]))).rows[0].id;
  assert.ok((await db.query('SELECT ngay_ket_thuc FROM hop_dong WHERE id=$1',[contract])).rows[0].ngay_ket_thuc);
  await asUser(OWNER,()=>rejectsCode(db.query('UPDATE hop_dong SET ngay_ket_thuc=NULL WHERE id=$1',[contract]),'23502'));
  const path=`${contract}/paper.jpg`;
  await asUser(OWNER,()=>db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('hop-dong-goc',$1)",[path]));
  await asUser(OWNER,()=>db.query('UPDATE hop_dong SET anh_hop_dong=ARRAY[$2] WHERE id=$1',[contract,path]));
  assert.equal((await asUser(tenant,()=>db.query("SELECT id FROM storage.objects WHERE bucket_id='hop-dong-goc' AND name=$1",[path]))).rows.length,1);
  assert.equal((await asUser(TENANT_A,()=>db.query("SELECT id FROM storage.objects WHERE bucket_id='hop-dong-goc' AND name=$1",[path]))).rows.length,0);
  await asUser(tenant,()=>rejectsCode(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('hop-dong-goc',$1)",[`${contract}/forged.jpg`]),'42501'));
  const target=(await db.query("SELECT (ngay_ket_thuc+interval '3 months')::date AS day FROM hop_dong WHERE id=$1",[contract])).rows[0].day;
  await asUser(TENANT_A,()=>rejectsCode(db.query("SELECT gui_yeu_cau_hop_dong($1,'gia_han',$2,'Xin gia hạn')",[contract,target]),'42501'));
  const request=(await asUser(tenant,()=>db.query("SELECT gui_yeu_cau_hop_dong($1,'gia_han',$2,'Xin gia hạn thêm') AS id",[contract,target]))).rows[0].id;
  await asUser(tenant,()=>assert.rejects(db.query("SELECT gui_yeu_cau_hop_dong($1,'gia_han',$2,'Gửi trùng')",[contract,target])));
  await asUser(MANAGER,()=>rejectsCode(db.query("SELECT duyet_yeu_cau_hop_dong($1,true,$2,'Duyệt')",[request,target]),'42501'));
  await asUser(ADMIN,()=>db.query("SELECT duyet_yeu_cau_hop_dong($1,true,$2,'Đồng ý gia hạn')",[request,target]));
  assert.equal(String((await db.query('SELECT ngay_ket_thuc FROM hop_dong WHERE id=$1',[contract])).rows[0].ngay_ket_thuc),String(target));
  await asUser(OWNER,()=>assert.rejects(db.query("SELECT duyet_yeu_cau_hop_dong($1,true,$2,'Duyệt lại')",[request,target])));
  const endRequest=(await asUser(tenant,()=>db.query("SELECT gui_yeu_cau_hop_dong($1,'cham_dut',$2,'Chuyển nơi ở') AS id",[contract,day]))).rows[0].id;
  await asUser(OWNER,()=>db.query("SELECT duyet_yeu_cau_hop_dong($1,false,NULL,'Chưa thống nhất ngày bàn giao')",[endRequest]));
  assert.equal((await db.query('SELECT trang_thai FROM hop_dong WHERE id=$1',[contract])).rows[0].trang_thai,'hieu_luc');
  const accepted=(await asUser(tenant,()=>db.query("SELECT gui_yeu_cau_hop_dong($1,'cham_dut',$2,'Đã thống nhất trả phòng') AS id",[contract,day]))).rows[0].id;
  await asUser(OWNER,()=>settle(contract,day,accepted));
  assert.equal((await db.query('SELECT trang_thai FROM hop_dong WHERE id=$1',[contract])).rows[0].trang_thai,'cham_dut');
  assert.equal((await db.query('SELECT trang_thai FROM phong_tro WHERE id=$1',[room])).rows[0].trang_thai,'trong');
  assert.ok((await db.query("SELECT id FROM thong_bao WHERE nguoi_nhan_id=$1 AND duong_dan='/hop-dong'",[tenant])).rows.length>=3);
});

test('lịch công tơ: 3 ngày trước hạn, giao tháng, khóa backend và mở bổ sung', async () => {
  const examples = [['2026-11-01',5,'2026-12-02','2026-12-04','2026-12-05'],['2026-11-01',1,'2026-11-28','2026-11-30','2026-12-01'],['2027-01-01',1,'2027-01-29','2027-01-31','2027-02-01']];
  for (const [ky,day,opens,closes,due] of examples) {
    const value=(await db.query('SELECT lich_nhap_cong_to($1,$2) AS value',[ky,day])).rows[0].value;
    assert.deepEqual(value,{opens,closes,due});
  }
  const tenant=id('00',92),room=id('20',92);
  await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[tenant,'84900000992',JSON.stringify({ho_ten:'Thuê thử công tơ'})]);
  await db.query('INSERT INTO phong_tro(id,khu_tro_id,so_phong,gia_thue_co_ban) VALUES($1,$2,$3,1000000)',[room,AREA_A,'CT92']);
  const contract=(await db.query("INSERT INTO hop_dong(phong_id,nguoi_thue_id,ngay_bat_dau,gia_thue,tien_coc,ngay_thanh_toan) VALUES($1,$2,(date_trunc('month',now() AT TIME ZONE 'Asia/Ho_Chi_Minh')-interval '3 months')::date,1000000,0,1) RETURNING id",[room,tenant])).rows[0].id;
  const ky=(await db.query("SELECT (date_trunc('month',now() AT TIME ZONE 'Asia/Ho_Chi_Minh')-interval '1 month')::date AS ky")).rows[0].ky;
  const state=()=>db.query('SELECT trang_thai_nhap_cong_to($1,$2) AS value',[contract,ky]);
  assert.equal((await asUser(tenant,state)).rows[0].value.allowed,false);
  await asUser(tenant,()=>rejectsCode(db.query('SELECT nguoi_thue_lap_hoa_don($1,$2,1,1,NULL,NULL,now(),now())',[contract,ky]),'22023'));
  await asUser(tenant,()=>rejectsCode(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('anh-cong-to',$1)",[`${room}/${tenant}/out-of-window.jpg`]),'42501'));
  await asUser(tenant,()=>rejectsCode(db.query("SELECT mo_bo_sung_cong_to($1,$2,24,'Tự mở')",[contract,ky]),'42501'));
  await asUser(MANAGER,()=>rejectsCode(db.query("SELECT mo_bo_sung_cong_to($1,$2,73,'Quá giới hạn')",[contract,ky]),'22023'));
  await asUser(MANAGER,()=>db.query("SELECT mo_bo_sung_cong_to($1,$2,24,'Người thuê đi công tác')",[contract,ky]));
  assert.equal((await asUser(tenant,state)).rows[0].value.allowed,true);
  await db.query("UPDATE mo_nhap_cong_to SET den_luc=now()-interval '1 minute' WHERE hop_dong_id=$1",[contract]);
  assert.equal((await asUser(tenant,state)).rows[0].value.allowed,false);
  const normal=(await db.query("SELECT extract(day FROM now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS day,date_trunc('month',now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS current, ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= (date_trunc('month',now() AT TIME ZONE 'Asia/Ho_Chi_Minh')+interval '1 month')::date-3) AS next_open")).rows[0];
  const period=normal.day<=27?ky:normal.current;
  await db.query('UPDATE hop_dong SET ngay_thanh_toan=$2 WHERE id=$1',[contract,normal.day<=27?normal.day+1:1]);
  assert.equal((await asUser(tenant,()=>db.query('SELECT trang_thai_nhap_cong_to($1,$2) AS value',[contract,period]))).rows[0].value.allowed,normal.day<=27 || normal.next_open);
});

test('nhắc công tơ: đủ 3 mốc, không trùng và dừng khi đã có chỉ số', async () => {
  const tenant=id('00',93),room=id('20',93);
  await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[tenant,'84900000993',JSON.stringify({ho_ten:'Thuê thử nhắc công tơ'})]);
  await db.query('INSERT INTO phong_tro(id,khu_tro_id,so_phong,gia_thue_co_ban) VALUES($1,$2,$3,1000000)',[room,AREA_A,'CT93']);
  const dates=(await db.query("SELECT (date_trunc('month',now() AT TIME ZONE 'Asia/Ho_Chi_Minh')+interval '1 month')::date AS ky,(date_trunc('month',now() AT TIME ZONE 'Asia/Ho_Chi_Minh')+interval '2 months')::date+4 AS due")).rows[0];
  const contract=(await db.query('INSERT INTO hop_dong(phong_id,nguoi_thue_id,ngay_bat_dau,gia_thue,tien_coc,ngay_thanh_toan) VALUES($1,$2,$3,1000000,0,5) RETURNING id',[room,tenant,dates.ky])).rows[0].id;
  const run=async offset=>Number((await db.query('SELECT tao_nhac_cong_to_noi_bo($1,$2::date+$3::int) AS n',[tenant,dates.due,offset])).rows[0].n);
  assert.equal(await run(-4),0);
  assert.equal(await run(-3),1);
  assert.equal(await run(-3),0);
  assert.equal(await run(-2),0);
  assert.equal(await run(-1),1);
  assert.equal(await run(-1),0);
  assert.equal(await run(0),1);
  assert.equal(await run(1),0);
  const notices=(await db.query('SELECT * FROM thong_bao WHERE nguoi_nhan_id=$1',[tenant])).rows;
  assert.equal(notices.length,3);
  assert.deepEqual(new Set(notices.map(n=>n.du_lieu.moc_cong_to)),new Set(['mo_nhap','ngay_cuoi','qua_han']));
  assert.ok(notices.every(n=>n.duong_dan.includes('/billing/chi-so?contract='+contract)));
  assert.equal((await db.query("SELECT has_function_privilege('authenticated','tao_nhac_cong_to_noi_bo(uuid,date)','EXECUTE') AS allowed")).rows[0].allowed,false);
  await db.query('DELETE FROM nhat_ky_nhac_cong_to WHERE hop_dong_id=$1',[contract]);
  await db.query('DELETE FROM thong_bao WHERE nguoi_nhan_id=$1',[tenant]);
  assert.equal(await run(-3),1);
  await db.query("INSERT INTO chi_so_cong_to(phong_id,loai,ky,chi_so_cu,chi_so_moi) VALUES($1,'dien',$2,0,10),($1,'nuoc',$2,0,2)",[room,dates.ky]);
  assert.equal(await run(-1),0);
  assert.equal(await run(0),0);
  assert.equal((await db.query('SELECT id FROM thong_bao WHERE nguoi_nhan_id=$1',[tenant])).rows.length,1);
});

test('quyết toán: chặn số liệu chưa chốt, cấn cọc, hoàn tiền, quyền và lưu biên bản bất biến', async () => {
  const tenant=id('00',94),room=id('20',94);
  await db.query("INSERT INTO auth.users VALUES($1,'84989990094',$2)",[tenant,JSON.stringify({ho_ten:'Khách quyết toán'})]);
  await db.query("INSERT INTO phong_tro(id,khu_tro_id,so_phong,gia_thue_co_ban) VALUES($1,$2,'QT94',1000000)",[room,AREA_A]);
  const day=(await db.query("SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS d")).rows[0].d;
  const contract=(await asUser(OWNER,()=>db.query('SELECT tao_hop_dong_day_du($1) AS id',[JSON.stringify({phong_id:room,nguoi_thue_id:tenant,ngay_bat_dau:day,gia_thue:1000000,tien_coc:1500000,so_nguoi_o:1,ngay_thanh_toan:5,dien_ban_dau:0,nuoc_ban_dau:0,dich_vu:[]})]))).rows[0].id;
  const ky=day.slice(0,7)+'-01';
  for (const kind of ['dien','nuoc']) await db.query('INSERT INTO chi_so_cong_to(phong_id,loai,ky,chi_so_cu,chi_so_moi) VALUES($1,$2,$3,0,0)',[room,kind,ky]);
  const bill=(await db.query('SELECT * FROM tao_hoa_don_noi_bo($1,$2)',[contract,ky])).rows[0];
  await asUser(OWNER,()=>assert.rejects(settle(contract,day),/Cần phát hành/));
  await db.query('SELECT phat_hanh_hoa_don($1)',[bill.id]);
  const payment=(await db.query("INSERT INTO thanh_toan(hoa_don_id,so_tien,nguoi_gui_id) VALUES($1,200000,$2) RETURNING id",[bill.id,tenant])).rows[0].id;
  await asUser(OWNER,()=>assert.rejects(settle(contract,day),/đối soát/));
  await db.query("UPDATE thanh_toan SET trang_thai='da_duyet' WHERE id=$1",[payment]);
  await db.query('SELECT dong_bo_trang_thai_hoa_don($1)',[bill.id]);
  const preview=async()=> (await asUser(OWNER,()=>db.query('SELECT xem_quyet_toan($1) AS v',[contract]))).rows[0].v;
  const snapshot=await preview();
  assert.equal(snapshot.debt,800000);assert.equal(snapshot.refund,700000);assert.equal(snapshot.collect,0);
  await asUser(MANAGER,()=>rejectsCode(db.query('SELECT xem_quyet_toan($1)',[contract]),'42501'));
  await asUser(tenant,()=>rejectsCode(settle(contract,day),'42501'));
  await asUser(OWNER,()=>assert.rejects(settle(contract,day,null,{confirm:false}),/Cần xác nhận/));
  await asUser(OWNER,()=>assert.rejects(settle(contract,day,null,{version:'old'}),/Số liệu đã thay đổi/));
  await asUser(OWNER,()=>rejectsCode(db.query("UPDATE hop_dong SET trang_thai='cham_dut' WHERE id=$1",[contract]),'22023'));
  const settlement=(await asUser(OWNER,()=>settle(contract,day))).rows[0].id;
  assert.equal((await db.query('SELECT trang_thai FROM hop_dong WHERE id=$1',[contract])).rows[0].trang_thai,'cham_dut');
  assert.equal((await db.query('SELECT trang_thai FROM phong_tro WHERE id=$1',[room])).rows[0].trang_thai,'trong');
  assert.equal((await db.query('SELECT trang_thai_thanh_toan FROM hoa_don WHERE id=$1',[bill.id])).rows[0].trang_thai_thanh_toan,'da_thanh_toan');
  const paid=(await db.query('SELECT so_tien,tien_coc_can_tru FROM thanh_toan WHERE quyet_toan_id=$1',[settlement])).rows[0];
  assert.equal(Number(paid.so_tien),800000);assert.equal(Number(paid.tien_coc_can_tru),800000);
  assert.equal((await asUser(tenant,()=>db.query('SELECT * FROM quyet_toan_hop_dong WHERE id=$1',[settlement]))).rows.length,1);
  assert.equal((await asUser(TENANT_A,()=>db.query('SELECT * FROM quyet_toan_hop_dong WHERE id=$1',[settlement]))).rows.length,0);
  await asUser(OWNER,()=>assert.rejects(settle(contract,day),/không còn chờ/));
  await rejectsCode(db.query('UPDATE thanh_toan SET so_tien=1 WHERE id=$1',[payment]),'42501');
  await asUser(OWNER,()=>rejectsCode(db.query('UPDATE hop_dong SET tien_coc=1 WHERE id=$1',[contract]),'42501'));
  await rejectsCode(db.query("INSERT INTO thanh_toan(hoa_don_id,so_tien) VALUES($1,1)",[bill.id]),'42501');
  await asUser(OWNER,()=>rejectsCode(db.query('DELETE FROM quyet_toan_hop_dong WHERE id=$1',[settlement]),'42501'));
});

test('quyết toán: thu bù khi cọc không đủ và không tạo hóa đơn sau bàn giao', async () => {
  const tenant=id('00',95),room=id('20',95);
  await db.query("INSERT INTO auth.users VALUES($1,'84989990095',$2)",[tenant,JSON.stringify({ho_ten:'Khách thu bù'})]);
  await db.query("INSERT INTO phong_tro(id,khu_tro_id,so_phong,gia_thue_co_ban) VALUES($1,$2,'QT95',1000000)",[room,AREA_A]);
  const day=(await db.query("SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS d")).rows[0].d;
  const contract=(await asUser(OWNER,()=>db.query('SELECT tao_hop_dong_day_du($1) AS id',[JSON.stringify({phong_id:room,nguoi_thue_id:tenant,ngay_bat_dau:day,gia_thue:1000000,tien_coc:300000,so_nguoi_o:1,ngay_thanh_toan:5,dien_ban_dau:0,nuoc_ban_dau:0,dich_vu:[]})]))).rows[0].id;
  const ky=day.slice(0,7)+'-01';
  for (const kind of ['dien','nuoc']) await db.query('INSERT INTO chi_so_cong_to(phong_id,loai,ky,chi_so_cu,chi_so_moi) VALUES($1,$2,$3,0,0)',[room,kind,ky]);
  const bill=(await db.query('SELECT * FROM tao_hoa_don_noi_bo($1,$2)',[contract,ky])).rows[0];
  await db.query('SELECT phat_hanh_hoa_don($1)',[bill.id]);
  const issue=(await asUser(tenant,()=>db.query("INSERT INTO su_co(phong_id,tieu_de) VALUES($1,'Sửa trước bàn giao') RETURNING id",[room]))).rows[0].id;
  await asUser(MANAGER,()=>update(issue,'hoan_tat','Đã sửa',100000));
  await asUser(OWNER,()=>assert.rejects(settle(contract,day),/phí sửa chữa/));
  await asUser(MANAGER,()=>update(issue,'dang_xu_ly','Chủ nhà chịu phí'));
  await asUser(MANAGER,()=>update(issue,'hoan_tat','Chủ nhà chịu phí',0));
  const settlement=(await asUser(ADMIN,()=>settle(contract,day))).rows[0].id;
  const row=(await db.query('SELECT * FROM quyet_toan_hop_dong WHERE id=$1',[settlement])).rows[0];
  assert.equal(Number(row.can_coc),300000);assert.equal(Number(row.thu_them),700000);assert.equal(Number(row.hoan_lai),0);
  const payment=(await db.query('SELECT * FROM thanh_toan WHERE quyet_toan_id=$1',[settlement])).rows[0];
  assert.equal(Number(payment.so_tien),1000000);assert.equal(Number(payment.tien_coc_can_tru),300000);
  await rejectsCode(db.query("INSERT INTO hoa_don(phong_id,hop_dong_id,thang_nam,tien_phong,chi_so_dien_cu,chi_so_dien_moi,tien_dien,chi_so_nuoc_cu,chi_so_nuoc_moi,tien_nuoc,tong_tien,han_thanh_toan) VALUES($1,$2,'01/2027',1,0,0,0,0,0,0,1,'2027-02-05')",[room,contract]),'42501');
});

test('sửa chữa: minh chứng, cộng phí một lần, lập lại nháp, mở lại và chuyển kỳ sau', async () => {

    const contract = (await db.query("SELECT id FROM hop_dong WHERE phong_id=$1 AND nguoi_thue_id=$2 AND trang_thai='hieu_luc'", [ROOM_A,TENANT_A])).rows[0].id;
    const period = (await db.query("SELECT date_trunc('month',now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS ky")).rows[0].ky;
    async function readings(ky) {
      for (const kind of ['dien','nuoc']) await db.query("INSERT INTO chi_so_cong_to(phong_id,loai,ky,chi_so_cu,chi_so_moi) VALUES($1,$2,$3,10,12) ON CONFLICT(phong_id,loai,ky) DO NOTHING", [ROOM_A,kind,ky]);
    }
    await readings(period);
    const bill = (await db.query('SELECT * FROM tao_hoa_don_noi_bo($1,$2)',[contract,period])).rows[0];
    const baseTotal = Number(bill.tong_tien);
    const total = async () => Number((await db.query('SELECT tong_tien FROM hoa_don WHERE id=$1',[bill.id])).rows[0].tong_tien);
    await asUser(MANAGER, () => rejectsCode(db.query("SELECT cap_nhat_xu_ly_su_co($1,'hoan_tat','Xong',350000)",[ISSUE_A]),'22023'));
    await asUser(TENANT_A, () => rejectsCode(db.query("UPDATE su_co SET minh_chung_xu_ly=ARRAY['fake.jpg'] WHERE id=$1",[ISSUE_A]),'42501'));
    await asUser(MANAGER, () => rejectsCode(db.query("SELECT cap_nhat_xu_ly_su_co($1,'hoan_tat','Xong',350000,ARRAY['fake.jpg'])",[ISSUE_A]),'22023'));
    await asUser(MANAGER, () => update(ISSUE_A,'hoan_tat','Đã thay thiết bị',350000));
    assert.equal(await total(),baseTotal+350000);
    assert.equal((await db.query('SELECT * FROM chi_tiet_hoa_don WHERE su_co_id=$1',[ISSUE_A])).rows.length,1);
    assert.equal((await history()).at(-1).minh_chung_xu_ly.length,1);
    assert.equal((await asUser(TENANT_A, () => db.query("UPDATE su_co SET minh_chung_xu_ly='{}' WHERE id=$1 RETURNING id",[ISSUE_A]))).rows.length,0);
    await asUser(MANAGER, () => update(ISSUE_A,'hoan_tat','Điều chỉnh chi phí',500000));
    assert.equal(await total(),baseTotal+500000);
    await db.query('SELECT tao_hoa_don_noi_bo($1,$2)',[contract,period]);
    assert.equal(await total(),baseTotal+500000);
    await asUser(MANAGER, () => rejectsCode(db.query('DELETE FROM chi_tiet_hoa_don WHERE su_co_id=$1',[ISSUE_A]),'42501'));
    await asUser(MANAGER, () => update(ISSUE_A,'dang_xu_ly','Kiểm tra lại'));
    assert.equal(await total(),baseTotal);
    await asUser(MANAGER, () => update(ISSUE_A,'hoan_tat','Đã kiểm tra lại',500000));
    await db.query('SELECT phat_hanh_hoa_don($1)',[bill.id]);
    await asUser(MANAGER, () => rejectsCode(update(ISSUE_A,'hoan_tat','Sửa phí sau phát hành',600000),'42501'));
    await asUser(MANAGER, () => rejectsCode(update(ISSUE_A,'dang_xu_ly','Mở lại sau phát hành'),'42501'));
    const issue2=(await asUser(TENANT_A,()=>db.query("INSERT INTO su_co(phong_id,tieu_de,mo_ta) VALUES($1,'Sửa ống nước','Báo cáo thứ hai') RETURNING id",[ROOM_A]))).rows[0].id;
    await asUser(MANAGER,()=>update(issue2,'hoan_tat','Đã sửa',100000));
    assert.equal(await total(),baseTotal+500000);
    assert.equal((await db.query('SELECT hoa_don_id FROM phi_sua_chua WHERE su_co_id=$1',[issue2])).rows[0].hoa_don_id,null);
    const next=(await db.query("SELECT ($1::date + interval '1 month')::date AS ky",[period])).rows[0].ky;
    await readings(next);
    const nextBill=(await db.query('SELECT * FROM tao_hoa_don_noi_bo($1,$2)',[contract,next])).rows[0];
    const lines=(await db.query('SELECT su_co_id,so_tien FROM chi_tiet_hoa_don WHERE hoa_don_id=$1 AND su_co_id IS NOT NULL',[nextBill.id])).rows;
    assert.equal(lines.length,1); assert.equal(lines[0].su_co_id,issue2); assert.equal(Number(lines[0].so_tien),100000);

});
