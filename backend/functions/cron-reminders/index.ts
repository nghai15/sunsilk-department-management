// Edge Function: Tác vụ định kỳ nhắc nợ trước/đúng/quá hạn
// Lên lịch chạy mỗi ngày (ví dụ: 08:00 AM) để quét các hóa đơn chưa thanh toán.

interface ReminderPayload {
  billId: string;
  roomNumber: string;
  tenantName: string;
  dueDate: string;
  totalAmount: number;
  status: 'upcoming' | 'due' | 'overdue';
}

export async function handler(req: Request): Promise<Response> {
  console.log("Starting cron-reminders job...");

  try {
    // 1. Quét danh sách hóa đơn chưa thanh toán trong CSDL
    // 2. Phân loại: Sắp đến hạn (còn 2-3 ngày), Đúng ngày đến hạn, Quá hạn
    // 3. Kích hoạt gửi Web Push hoặc Zalo/SMS notification cho từng khách thuê

    return new Response(JSON.stringify({ success: true, processed: 0 }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}
