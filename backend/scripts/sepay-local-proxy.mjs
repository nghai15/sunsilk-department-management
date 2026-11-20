import http from 'node:http';
// Chỉ mở đường dẫn webhook ra tunnel, không mở Auth, REST, Storage hoặc Studio.
const target = 'http://127.0.0.1:54321/functions/v1/sepay-webhook';
http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/sepay-webhook') { res.writeHead(404).end(); return; }
  try {
    let size = 0; const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 16384) { res.writeHead(413).end(); return; }
      chunks.push(chunk);
    }
    const upstream = await fetch(target, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization ?? '' }, body: Buffer.concat(chunks), signal: AbortSignal.timeout(20000) });
    res.writeHead(upstream.status, { 'Content-Type': 'application/json' }).end(await upstream.text());
  } catch { res.writeHead(502).end('{"success":false}'); }
}).listen(8788, '127.0.0.1', () => console.log('Webhook proxy: http://127.0.0.1:8788/sepay-webhook'));
