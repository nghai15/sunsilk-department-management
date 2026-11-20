type Config = { apiKey?: string; account?: string; bankBin?: string; gateway?: string }
type Transaction = { p_id: number; p_bin: string; p_account: string; p_content: string; p_amount: number; p_code: string }
type Save = (transaction: Transaction) => Promise<{ error: unknown }>
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export async function handleWebhook(req: Request, config: Config, save: Save): Promise<Response> {
  if (req.method !== 'POST') return json({ success: false }, 405)
  if (!config.apiKey || config.apiKey.length < 32 || !config.account || !config.bankBin || !config.gateway) return json({ success: false, error: 'Webhook chưa được cấu hình.' }, 503)
  const supplied = req.headers.get('Authorization') ?? ''
  const expected = `Apikey ${config.apiKey}`
  const hash = async (text: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  const [a, b] = await Promise.all([hash(supplied), hash(expected)])
  let difference = 0
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i]
  if (difference !== 0) return json({ success: false }, 401)
  let data: Record<string, unknown>
  try {
    const body = await req.text()
    if (body.length > 16384) return json({ success: false }, 413)
    data = JSON.parse(body)
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error()
  } catch { return json({ success: false }, 400) }
  if (data.accountNumber !== config.account || data.gateway !== config.gateway) return json({ success: false, error: 'Tài khoản không khớp cấu hình.' }, 400)
  if (data.transferType === 'out') return json({ success: true, ignored: true })
  if (data.transferType !== 'in' || !Number.isSafeInteger(data.id) || Number(data.id) <= 0 || !Number.isSafeInteger(data.transferAmount) || Number(data.transferAmount) <= 0 || Number(data.transferAmount) > 9999999999 || typeof data.content !== 'string' || data.content.length > 4000) return json({ success: false }, 400)
  // Chỉ ghép khi nội dung chứa đúng một mã hóa đơn đầy đủ, không đoán theo số tiền.
  const codes = [...new Set(data.content.toUpperCase().match(/\bSS[A-F0-9]{32}\b/g) ?? [])]
  try {
    const result = await save({ p_id: Number(data.id), p_bin: config.bankBin, p_account: config.account, p_content: data.content, p_amount: Number(data.transferAmount), p_code: codes.length === 1 ? codes[0] : '' })
    if (result.error) return json({ success: false, error: 'Chưa ghi nhận được giao dịch. Vui lòng gửi lại.' }, 500)
    return json({ success: true })
  } catch { return json({ success: false }, 500) }
}
