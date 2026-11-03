-- Lên lịch chạy cron-reminders hằng ngày lúc 08:00 giờ Việt Nam (01:00 UTC).
-- Chạy MỘT LẦN trong SQL Editor của Supabase, sau khi đã deploy function và bật extension pg_cron + pg_net.
-- Thay <PROJECT_REF> và giá trị bí mật cho đúng, KHÔNG commit giá trị thật vào git.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Lưu CRON_SECRET (trùng với secret đã set cho function) vào Vault
SELECT vault.create_secret('<GIA_TRI_CRON_SECRET>', 'cron_secret');

SELECT cron.schedule(
  'cron-reminders-daily',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/cron-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Kiểm tra / gỡ lịch:
--   SELECT * FROM cron.job;   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--   SELECT cron.unschedule('cron-reminders-daily');
