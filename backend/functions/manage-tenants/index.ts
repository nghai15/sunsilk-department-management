import { adminClient } from "../_shared/supabase.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function handleRequest(req: Request, staff = false): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "Phương thức không hợp lệ." }, 405);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Vui lòng đăng nhập." }, 401);
  const admin = adminClient();
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Phiên đăng nhập không hợp lệ." }, 401);
  const { data: actor, error: actorError } = await admin.from("nguoi_dung")
    .select("vai_tro,dang_hoat_dong").eq("id", auth.user.id).single();
  if (actorError || !actor?.dang_hoat_dong || !["chu_tro", "quan_tri"].includes(actor.vai_tro)) {
    return json({ error: "Chỉ chủ trọ và quản trị viên được quản lý người thuê." }, 403);
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Dữ liệu không hợp lệ." }, 400); }
  if (!body || !["create", "update", "delete"].includes(String(body.action))) return json({ error: "Thao tác không hợp lệ." }, 400);
  const id = typeof body.id === "string" ? body.id : "";
  const allowedRoles = staff ? (actor.vai_tro === 'chu_tro' ? ['quan_tri', 'quan_ly'] : ['quan_ly']) : ['nguoi_thue'];
  const desiredRole = staff ? String(body.role ?? 'quan_ly') : 'nguoi_thue';
  if (!allowedRoles.includes(desiredRole)) return json({ error: 'Không có quyền cấp vai trò này.' }, 403);
  if (body.action !== "create") {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Người thuê không hợp lệ." }, 400);
    const { data: target, error } = await admin.from("nguoi_dung").select("vai_tro").eq("id", id).single();
    if (error || !allowedRoles.includes(target?.vai_tro) || id === auth.user.id) return json({ error: "Không tìm thấy tài khoản có thể quản lý." }, 404);
  }
  if (body.action === "delete") {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return json({ error: "Không thể xóa người thuê đang có hợp đồng, ảnh hoặc dữ liệu liên quan." }, 409);
    return json({ success: true });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.replace(/[\s.\-()]/g, "").replace(/^\+/, "").replace(/^0/, "84") : "";
  const cccd = typeof body.cccd === "string" ? body.cccd.trim() : "";
  if (!staff && !/^\d{12}$/.test(cccd)) {
    return json({ error: "Người thuê bắt buộc có số căn cước gồm đúng 12 chữ số." }, 400);
  }
  if (!name || name.length > 100 || !/^84[35789]\d{8}$/.test(phone) || (cccd && !/^\d{12}$/.test(cccd))) {
    return json({ error: "Nhập họ tên, số di động Việt Nam hợp lệ và CCCD 12 số (nếu có)." }, 400);
  }
  const metadata = { ho_ten: name, cccd };
  if (body.action === "create") {
    if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 72) return json({ error: "Mật khẩu cần từ 8 đến 72 ký tự." }, 400);
    const { data, error } = await admin.auth.admin.createUser({ phone, password: body.password, phone_confirm: true, user_metadata: metadata });
    if (error) return json({ error: error.code === "phone_exists" || error.status === 422 ? "Số điện thoại đã được sử dụng hoặc thông tin chưa hợp lệ." : "Không tạo được người thuê. Kiểm tra số điện thoại và thử lại." }, 409);
    if (staff) {
      const assigned = await admin.from('nguoi_dung').update({ vai_tro: desiredRole }).eq('id', data.user.id);
      if (assigned.error) { await admin.auth.admin.deleteUser(data.user.id); return json({ error: 'Không cấp được vai trò nhân sự.' }, 500); }
    }
    return json({ id: data.user.id }, 201);
  }
  const { error } = await admin.auth.admin.updateUserById(id, { phone, phone_confirm: true, user_metadata: metadata });
  if (error) return json({ error: "Không lưu được thông tin. Số điện thoại có thể đã được sử dụng." }, 409);
  if (staff) {
    const assigned = await admin.from('nguoi_dung').update({ vai_tro: desiredRole }).eq('id', id);
    if (assigned.error) return json({ error: 'Đã lưu thông tin nhưng chưa đổi được vai trò. Vui lòng thử lại.' }, 500);
  }
  return json({ id });
}

if (import.meta.main) Deno.serve(req => handleRequest(req).catch(() => json({ error: "Không xử lý được yêu cầu. Vui lòng thử lại." }, 500)));
