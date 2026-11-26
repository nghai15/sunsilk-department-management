CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('meter-reading-reminders','*/15 * * * *','SELECT public.gui_nhac_cong_to();');
