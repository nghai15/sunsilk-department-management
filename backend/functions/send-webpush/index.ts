// Edge Function: đẩy Web Push (giao thức VAPID) tới PWA của người nhận thông báo.
//
// Hai cách gọi (đều yêu cầu service role key hoặc x-cron-secret, xem _shared/guard.ts):
//   1. Database Webhook trên INSERT bảng public.thong_bao  -> body { type:"INSERT", record:{...} }
//   2. Gọi trực tiếp (vd từ cron-reminders)                     -> body { thong_bao_ids: ["uuid", ...] }
//
// Chống gửi trùng: mỗi thông báo được "giành quyền gửi" bằng UPDATE da_gui_push_luc ... WHERE da_gui_push_luc IS NULL,
// nên dù webhook và lời gọi trực tiếp cùng chạy thì chỉ một bên gửi.
//
// Secrets cần có:  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (vd mailto:admin@example.com)
import webpush from "npm:web-push@3.6.7";
import { adminClient } from "../_shared/supabase.ts";
import { isAuthorized, json } from "../_shared/guard.ts";

// Một dòng bảng thong_bao (tên trường = tên cột trong CSDL)
interface ThongBaoRow {
  id: string;
  nguoi_nhan_id: string;
  loai: string;
  tieu_de: string;
  noi_dung: string;
  duong_dan: string | null;
  du_lieu: Record<string, unknown> | null;
}

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
  if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: "Thiếu VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY" }, 500);
  }

  let payload: { type?: string; record?: { id?: string }; thong_bao_ids?: string[] };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Body không phải JSON hợp lệ" }, 400);
  }

  const ids: string[] = payload.thong_bao_ids?.length
    ? payload.thong_bao_ids
    : payload.record?.id ? [payload.record.id] : [];
  if (ids.length === 0) return json({ error: "Thiếu thong_bao_ids hoặc record.id" }, 400);
  if (ids.length > 500) return json({ error: "Tối đa 500 thông báo mỗi lần" }, 400);

  const db = adminClient();

  // 1. Giành quyền gửi (idempotent)
  const { data: claimed, error: claimErr } = await db
    .from("thong_bao")
    .update({ da_gui_push_luc: new Date().toISOString() })
    .in("id", ids)
    .is("da_gui_push_luc", null)
    .select("id, nguoi_nhan_id, loai, tieu_de, noi_dung, duong_dan, du_lieu");
  if (claimErr) return json({ error: claimErr.message }, 500);
  const notifications = (claimed ?? []) as ThongBaoRow[];
  if (notifications.length === 0) return json({ success: true, da_nhan_quyen: 0, da_gui: 0, that_bai: 0, da_go_thiet_bi: 0, thu_lai: 0 });

  // 2. Lấy toàn bộ thiết bị của những người nhận
  const recipientIds = [...new Set(notifications.map((n) => n.nguoi_nhan_id))];
  const { data: subs, error: subErr } = await db
    .from("dang_ky_push")
    .select("id, nguoi_dung_id, endpoint, p256dh, khoa_auth")
    .in("nguoi_dung_id", recipientIds);
  if (subErr) {
    // chưa gửi được gì -> trả lại quyền gửi để lần sau thử lại
    await db.from("thong_bao").update({ da_gui_push_luc: null }).in("id", notifications.map((n) => n.id));
    return json({ error: subErr.message }, 500);
  }

  const byUser = new Map<string, typeof subs>();
  for (const s of subs ?? []) byUser.set(s.nguoi_dung_id, [...(byUser.get(s.nguoi_dung_id) ?? []), s]);

  const resultsByNotification = new Map<string, { delivered: number; transient: number }>();
  let sent = 0, failed = 0;
  const deadSubIds = new Set<string>();
  // Thông báo có thiết bị nhưng không gửi được cái nào vì lỗi tạm thời (mạng, 5xx, 429)
  // -> trả lại quyền gửi để cron-reminders quét lại sau.
  const retryIds: string[] = [];

  const jobs: Array<() => Promise<void>> = [];
  for (const n of notifications) {
    const targets = byUser.get(n.nguoi_nhan_id) ?? [];
    if (targets.length === 0) continue; // người nhận chưa bật push: chỉ hiển thị trong hộp thư in-app

    const message = JSON.stringify({
      // Khóa title/body/data/url là chuẩn Web Push mà sw.js đọc - giữ nguyên tiếng Anh
      title: n.tieu_de,
      body: n.noi_dung,
      data: { ...(n.du_lieu ?? {}), url: n.duong_dan ?? "/", thong_bao_id: n.id, loai: n.loai },
    });
    const result = { delivered: 0, transient: 0 };
    for (const s of targets) {
      jobs.push(async () => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.khoa_auth } },
            message,
            { TTL: 24 * 3600, urgency: "high" },
          );
          sent++;
          result.delivered++;
        } catch (e) {
          failed++;
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            deadSubIds.add(s.id); // thiết bị đã gỡ đăng ký
          } else {
            result.transient++;
            console.error(`push lỗi (${status ?? "?"}) tới ${s.endpoint.slice(0, 48)}…`, (e as Error).message);
          }
        }
      });
    }
    resultsByNotification.set(n.id, result);
  }

  const BATCH = 20;
  for (let i = 0; i < jobs.length; i += BATCH) {
    await Promise.all(jobs.slice(i, i + BATCH).map((j) => j()));
  }
  for (const [id, r] of resultsByNotification) {
    if (r.delivered === 0 && r.transient > 0) retryIds.push(id);
  }

  if (deadSubIds.size > 0) {
    await db.from("dang_ky_push").delete().in("id", [...deadSubIds]);
  }
  if (retryIds.length > 0) {
    await db.from("thong_bao").update({ da_gui_push_luc: null }).in("id", retryIds);
  }

  return json({
    success: true,
    da_nhan_quyen: notifications.length,
    da_gui: sent,
    that_bai: failed,
    da_go_thiet_bi: deadSubIds.size,
    thu_lai: retryIds.length,
  });
}

Deno.serve(handler);
