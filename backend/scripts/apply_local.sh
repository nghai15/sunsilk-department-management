#!/usr/bin/env bash
# Áp dụng migrations (+ seed nếu truyền --seed) vào một Postgres bất kỳ, dùng khi không có Supabase CLI.
# Ví dụ:  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres ./scripts/apply_local.sh --seed
# Lưu ý: chỉ chạy trên DB MỚI (migrations không idempotent hoàn toàn); DB Supabase thật nên dùng `supabase db push`.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?Cần đặt DATABASE_URL}"
for f in migrations/*.sql; do echo ">> $f"; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"; done
if [[ "${1:-}" == "--seed" ]]; then echo ">> seed"; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f seed/001_seed_data.sql; fi
echo "Xong."
