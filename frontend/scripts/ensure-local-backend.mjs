import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const frontend = new URL('../', import.meta.url);
let url = process.env.VITE_SUPABASE_URL;
if (!url) {
  for (const file of ['.env', '.env.local', '.env.development', '.env.development.local']) {
    try {
      const source = await readFile(new URL(file, frontend), 'utf8');
      const found = source.match(/^\s*VITE_SUPABASE_URL\s*=\s*(.+?)\s*$/m)?.[1];
      if (found) url = found.replace(/^["']|["']$/g, '');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
if (url && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) {
  const config = await readFile(new URL('../../backend/supabase/config.toml', import.meta.url), 'utf8');
  const project = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
  if (!project) throw new Error('Không tìm thấy project_id của Supabase local.');
  const container = `supabase_edge_runtime_${project}`;
  const docker = args => execFileSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    const state = JSON.parse(docker(['inspect', '--format', '{{json .State}}', container]));
    docker(['update', '--restart', 'unless-stopped', container]);
    if (!state.Running) { docker(['start', container]); console.log('Đã bật dịch vụ quản lý người thuê local.'); }
  } catch {
    console.error('Chưa khởi động được dịch vụ local. Mở Docker Desktop; trong thư mục backend chạy npx.cmd supabase start, rồi chạy lại npm.cmd run dev.');
    process.exit(1);
  }
  let ready = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/functions/v1/manage-tenants`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(1500) });
      const data = await response.json();
      if (response.status === 401 && data.error === 'Vui lòng đăng nhập.') { ready = true; break; }
    } catch { /* Chờ runtime khởi động. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) {
    console.error('Dịch vụ thêm/sửa/xóa người thuê chưa sẵn sàng. Trong thư mục backend chạy npx.cmd supabase functions serve, giữ terminal đó mở rồi chạy lại frontend.');
    process.exit(1);
  }
  console.log('Dịch vụ quản lý người thuê local đã sẵn sàng.');
}
