import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const backend = new URL('../', import.meta.url);
const names = readdirSync(new URL('migrations/',backend)).filter(n=>n.endsWith('.sql')).sort();
const tables = new Set();
for (const name of names) {
  const source=readFileSync(new URL(`migrations/${name}`,backend),'utf8');
  assert.equal(source,readFileSync(new URL(`supabase/migrations/${name}`,backend),'utf8'),`Migration chưa đồng bộ: ${name}`);
  for (const match of source.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? (?:public\.)?([a-z_]+)/gi)) tables.add(match[1]);
}
if (process.argv.includes('--files-only')) { console.log(`OK: ${names.length} migrations đồng bộ, định nghĩa ${tables.size} bảng nghiệp vụ.`); process.exit(0); }
const project=readFileSync(new URL('supabase/config.toml',backend),'utf8').match(/^project_id\s*=\s*"([^"\r\n]+)"/m)[1];
const requiredColumns=[['hop_dong','ngay_ket_thuc'],['hop_dong','anh_hop_dong'],['thanh_toan','quyet_toan_id'],['thanh_toan','tien_coc_can_tru'],['su_co','minh_chung_xu_ly'],['chi_tiet_hoa_don','su_co_id'],['hoa_don','ma_thanh_toan']];
const query=`SELECT 'Thiếu bảng: '||name FROM unnest(ARRAY[${[...tables].map(n=>`'${n}'`).join(',')}]) name WHERE to_regclass('public.'||name) IS NULL
 UNION ALL SELECT 'Thiếu cột: '||t||'.'||c FROM (VALUES ${requiredColumns.map(([t,c])=>`('${t}','${c}')`).join(',')}) required(t,c) WHERE NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name=c)
 UNION ALL SELECT 'Thiếu hàm: '||name FROM unnest(ARRAY['xac_nhan_quyet_toan','xem_quyet_toan','gui_nhac_cong_to','trang_thai_nhap_cong_to','gui_yeu_cau_hop_dong']) name WHERE NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=name);`;
try {
  const output=execFileSync('docker',['exec','-i',`supabase_db_${project}`,'psql','-X','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe']}).trim();
  if(output) { console.error(output); console.error('Database đang dùng schema cũ. Xem backend/README.md mục Máy đã chạy phiên bản cũ.'); process.exit(1); }
  console.log(`OK: đủ ${tables.size} bảng, các cột và hàm mới cần cho ứng dụng.`);
} catch { console.error('Không kiểm tra được database local. Mở Docker và chạy Supabase trước.'); process.exit(1); }
