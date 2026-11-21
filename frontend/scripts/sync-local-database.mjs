import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export function localUpgradeSql() {
  const file = '../../backend/supabase/migrations/006_quy_trinh_xu_ly_su_co.sql';
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const hash = createHash('sha256').update(source).digest('hex');
  // 006 hỗ trợ chạy lại. Giữ cập nhật và dấu phiên bản trong cùng transaction.
  const body = source.replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '');
  return String.raw`BEGIN;
SELECT pg_advisory_xact_lock(72061206);
CREATE SCHEMA IF NOT EXISTS sunsilk_dev;
REVOKE ALL ON SCHEMA sunsilk_dev FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS sunsilk_dev.updates (name text PRIMARY KEY, checksum text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
SELECT NOT EXISTS(SELECT 1 FROM sunsilk_dev.updates WHERE name='006' AND checksum='${hash}') AS needs_update \gset
\if :needs_update
${body}
INSERT INTO sunsilk_dev.updates(name,checksum) VALUES('006','${hash}') ON CONFLICT(name) DO UPDATE SET checksum=excluded.checksum,updated_at=now();
NOTIFY pgrst, 'reload schema';
\echo SUNSILK_UPDATED
\endif
COMMIT;
`;
}

export function syncLocalDatabase(project) {
  try {
    const output = execFileSync('docker', ['exec','-i',`supabase_db_${project}`,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-q'], {
      input: localUpgradeSql(), encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 4 * 1024 * 1024, stdio: ['pipe','pipe','pipe'],
    });
    if (output.includes('SUNSILK_UPDATED')) console.log('Đã tự cập nhật database local, giữ nguyên dữ liệu.');
  } catch (error) {
    console.error('Không cập nhật được database local; chưa mở web. Dữ liệu cập nhật dở đã được hoàn tác. Kiểm tra Docker/Supabase đang chạy.');
    if (error.stderr) console.error(String(error.stderr));
    throw error;
  }
}
