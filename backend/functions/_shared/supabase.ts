// Client Supabase dùng service role (bỏ qua RLS) - CHỈ dùng trong Edge Functions, không bao giờ gửi xuống client.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
