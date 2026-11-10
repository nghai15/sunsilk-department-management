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

async function update(issueId, state, note = null, cost = null) {
  return (await db.query(
    'SELECT * FROM cap_nhat_xu_ly_su_co($1::uuid, $2::text, $3::text, $4::numeric)',
    [issueId, state, note, cost],
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
  await db.exec('DELETE FROM su_co; DELETE FROM thong_bao');
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
