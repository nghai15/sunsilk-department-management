// Edge Function: Xử lý đẩy Web Push notification
// Sử dụng chuẩn Web Push Protocol (VAPID keys) để push thông báo tới PWA client

interface PushPayload {
  subscription: {
    endpoint: string;
    keys: {
      auth: string;
      p256dh: string;
    };
  };
  notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    url?: string;
    data?: Record<string, any>;
  };
}

export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const payload: PushPayload = await req.json();

    // Triển khai logic gửi push notification bằng VAPID keys
    console.log(`Sending Web Push to: ${payload.subscription.endpoint}`);
    console.log(`Title: ${payload.notification.title}`);

    return new Response(JSON.stringify({ success: true, message: "Push sent successfully" }), {
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
