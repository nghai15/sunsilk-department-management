import { adminClient } from '../_shared/supabase.ts';
import { handleWebhook } from './handler.ts';

Deno.serve(req => handleWebhook(req, {
  apiKey: Deno.env.get('SEPAY_WEBHOOK_API_KEY'),
  account: Deno.env.get('SEPAY_ACCOUNT_NUMBER'),
  bankBin: Deno.env.get('SEPAY_BANK_BIN'),
  gateway: Deno.env.get('SEPAY_GATEWAY'),
}, transaction => adminClient().rpc('nhan_giao_dich_sepay', transaction)));
