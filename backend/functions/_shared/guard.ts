// Chỉ cho phép lời gọi "máy-với-máy": Database Webhook / pg_cron / function khác.
// Chấp nhận (1) Authorization: Bearer <SERVICE_ROLE_KEY> hoặc (2) header x-cron-secret = CRON_SECRET.
import { SERVICE_ROLE_KEY } from "./supabase.ts";

function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

export function isAuthorized(req: Request): boolean {
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (bearer && SERVICE_ROLE_KEY && safeEqual(bearer, SERVICE_ROLE_KEY)) return true;

  const secret = Deno.env.get("CRON_SECRET");
  const sent = req.headers.get("x-cron-secret") ?? "";
  return Boolean(secret && sent && safeEqual(sent, secret));
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
