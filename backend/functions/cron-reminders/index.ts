// Edge Function: nhắc nợ tự động (chạy mỗi ngày, ví dụ 08:00 giờ Việt Nam = 01:00 UTC).
//
// Mỗi lần chạy:
//   1. Đánh dấu hóa đơn quá hạn (RPC danh_dau_hoa_don_qua_han).
//   2. Quét hóa đơn đã phát hành, chưa thanh toán, và gửi nhắc theo 3 mốc:
//        - sap_den_han: còn đúng N ngày đến hạn (N = khu_tro.so_ngay_nhac_truoc, mặc định 3;
//                    nếu lỡ nhịp thì nhắc bù 1 lần khi còn <= N ngày)
//        - den_han    : đúng ngày đến hạn
//        - qua_han    : quá hạn, lặp lại mỗi M ngày (M = khu_tro.so_ngay_lap_nhac_qua_han, mặc định 3)
//   3. Đẩy Web Push cho các thông báo vừa tạo, đồng thời quét lại thông báo 24h gần nhất chưa đẩy được.
//
// Chống nhắc trùng: bảng nhat_ky_nhac_no có UNIQUE (hoa_don_id, loai, ngay_gui); mỗi lời nhắc được "giữ chỗ"
// trong log trước khi tạo thông báo, nên chạy lại hoặc chạy song song đều an toàn.
//
// Hóa đơn ở trạng thái cho_xac_nhan (người thuê đã gửi biên lai) KHÔNG bị nhắc.
import { adminClient, SERVICE_ROLE_KEY, SUPABASE_URL } from "../_shared/supabase.ts";
import { isAuthorized, json } from "../_shared/guard.ts";

type Loai = "sap_den_han" | "den_han" | "qua_han";

// Một dòng bảng hoa_don kèm phong_tro -> khu_tro và hop_dong (tên trường = tên cột trong CSDL)
interface HoaDonRow {
  id: string;
  thang_nam: string;
  tong_tien: number;
  han_thanh_toan: string; // YYYY-MM-DD
  trang_thai_thanh_toan: string;
  phong: {
    so_phong: string;
    khu_tro: { id: string; so_ngay_nhac_truoc: number; so_ngay_lap_nhac_qua_han: number };
  };
  hop_dong: { nguoi_thue_id: string };
}

const MS_PER_DAY = 86_400_000;

/** Ngày hiện tại theo giờ Việt Nam, dạng YYYY-MM-DD. */
export function todayInVietnam(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
}

/** Số ngày từ `from` đến `to` (dương = `to` ở tương lai). Cả hai là YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

const vnd = (n: number) => `${new Intl.NumberFormat("vi-VN").format(Number(n))}đ`;
const vnDate = (iso: string) => iso.split("-").reverse().join("/");

export function buildMessage(loai: Loai, b: HoaDonRow, daysLeft: number) {
  const room = `Phòng ${b.phong.so_phong}`;
  const amount = vnd(b.tong_tien);
  switch (loai) {
    case "sap_den_han":
      return {
        type: "hoa_don_sap_den_han",
        title: `Sắp đến hạn đóng tiền phòng (${daysLeft} ngày)`,
        body: `${room} - hóa đơn ${b.thang_nam}: ${amount}, hạn ${vnDate(b.han_thanh_toan)}.`,
      };
    case "den_han":
      return {
        type: "hoa_don_den_han",
        title: "Hôm nay là hạn đóng tiền phòng",
        body: `${room} - hóa đơn ${b.thang_nam}: ${amount}. Vui lòng thanh toán hôm nay.`,
      };
    case "qua_han":
      return {
        type: "hoa_don_qua_han",
        title: `Hóa đơn quá hạn ${-daysLeft} ngày`,
        body: `${room} - hóa đơn ${b.thang_nam}: ${amount}, hạn ${vnDate(b.han_thanh_toan)}. Vui lòng thanh toán sớm.`,
      };
  }
}

export async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "Method Not Allowed" }, 405);
  if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  const db = adminClient();
  const today = todayInVietnam();
  const dryRun = new URL(req.url).searchParams.get("dry_run") === "1";
  const summary = { hom_nay: today, da_danh_dau_qua_han: 0, sap_den_han: 0, den_han: 0, qua_han: 0, bo_qua: 0, loi: 0, push: null as unknown };

  try {
    // 1. Cập nhật trạng thái quá hạn
    if (!dryRun) {
      const { data: marked, error } = await db.rpc("danh_dau_hoa_don_qua_han");
      if (error) throw new Error(`danh_dau_hoa_don_qua_han: ${error.message}`);
      summary.da_danh_dau_qua_han = Number(marked ?? 0);
    }

    // 2. Hóa đơn cần theo dõi
    const { data, error: qErr } = await db
      .from("hoa_don")
      .select(
        `id, thang_nam, tong_tien, han_thanh_toan, trang_thai_thanh_toan,
         phong:phong_tro!inner(so_phong, khu_tro!inner(id, so_ngay_nhac_truoc, so_ngay_lap_nhac_qua_han)),
         hop_dong!inner(nguoi_thue_id)`,
      )
      .eq("la_ban_nhap", false)
      .in("trang_thai_thanh_toan", ["chua_thanh_toan", "qua_han"])
      .limit(5000);
    if (qErr) throw new Error(`truy vấn hoa_don: ${qErr.message}`);
    const bills = (data ?? []) as unknown as HoaDonRow[];

    // Lịch sử nhắc của các hóa đơn này (để nhắc bù và giãn cách nhắc quá hạn)
    const history = new Map<string, { sapDenHan: boolean; quaHanGanNhat: string | null }>();
    if (bills.length > 0) {
      const { data: logs, error: lErr } = await db
        .from("nhat_ky_nhac_no")
        .select("hoa_don_id, loai, ngay_gui")
        .in("hoa_don_id", bills.map((b) => b.id));
      if (lErr) throw new Error(`nhat_ky_nhac_no: ${lErr.message}`);
      for (const l of logs ?? []) {
        const h = history.get(l.hoa_don_id) ?? { sapDenHan: false, quaHanGanNhat: null };
        if (l.loai === "sap_den_han") h.sapDenHan = true;
        if (l.loai === "qua_han" && (!h.quaHanGanNhat || l.ngay_gui > h.quaHanGanNhat)) h.quaHanGanNhat = l.ngay_gui;
        history.set(l.hoa_don_id, h);
      }
    }

    // 3. Quyết định nhắc gì cho từng hóa đơn
    for (const b of bills) {
      const { so_ngay_nhac_truoc: before, so_ngay_lap_nhac_qua_han: repeat } = b.phong.khu_tro;
      const daysLeft = daysBetween(today, b.han_thanh_toan);
      const h = history.get(b.id) ?? { sapDenHan: false, quaHanGanNhat: null };

      let loai: Loai | null = null;
      if (daysLeft < 0) {
        if (!h.quaHanGanNhat || daysBetween(h.quaHanGanNhat, today) >= repeat) loai = "qua_han";
      } else if (daysLeft === 0) {
        loai = "den_han";
      } else if (before > 0 && daysLeft <= before && !h.sapDenHan) {
        loai = "sap_den_han";
      }
      if (!loai) { summary.bo_qua++; continue; }
      if (dryRun) { summary[loai]++; continue; }

      // Giữ chỗ trong log trước; nếu đã có (chạy trùng) thì bỏ qua
      const { data: claimed, error: cErr } = await db
        .from("nhat_ky_nhac_no")
        .upsert({ hoa_don_id: b.id, loai, ngay_gui: today }, { onConflict: "hoa_don_id,loai,ngay_gui", ignoreDuplicates: true })
        .select("id");
      if (cErr) { console.error("giữ chỗ nhật ký", b.id, cErr.message); summary.loi++; continue; }
      if (!claimed || claimed.length === 0) { summary.bo_qua++; continue; }

      const msg = buildMessage(loai, b, daysLeft);
      const { error: nErr } = await db.from("thong_bao").insert({
        nguoi_nhan_id: b.hop_dong.nguoi_thue_id,
        loai: msg.type,
        tieu_de: msg.title,
        noi_dung: msg.body,
        duong_dan: `/billing/${b.id}`,
        du_lieu: { hoa_don_id: b.id, loai },
      });
      if (nErr) {
        // không tạo được thông báo -> hoàn tác giữ chỗ để lần chạy sau nhắc lại
        console.error("tạo thông báo", b.id, nErr.message);
        await db.from("nhat_ky_nhac_no").delete().eq("id", claimed[0].id);
        summary.loi++;
        continue;
      }
      summary[loai]++;
    }

    // 4. Đẩy Web Push: các thông báo chưa đẩy trong 24h qua (gồm cả vừa tạo ở trên)
    if (!dryRun) {
      const since = new Date(Date.now() - MS_PER_DAY).toISOString();
      const { data: pending, error: pErr } = await db
        .from("thong_bao")
        .select("id")
        .is("da_gui_push_luc", null)
        .gte("tao_luc", since)
        .order("tao_luc")
        .limit(500);
      if (pErr) throw new Error(`thông báo chờ đẩy push: ${pErr.message}`);

      if (pending && pending.length > 0) {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-webpush`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ thong_bao_ids: pending.map((p) => p.id) }),
        });
        summary.push = res.ok ? await res.json() : { error: `send-webpush HTTP ${res.status}` };
      }
    }

    return json({ success: true, dry_run: dryRun, ...summary });
  } catch (e) {
    console.error("cron-reminders lỗi:", e);
    return json({ success: false, error: (e as Error).message, ...summary }, 500);
  }
}

Deno.serve(handler);
