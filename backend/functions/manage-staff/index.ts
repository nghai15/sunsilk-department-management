import { handleRequest } from '../manage-tenants/index.ts';
Deno.serve(req => handleRequest(req, true).catch(() => new Response(JSON.stringify({ error: 'Không xử lý được yêu cầu.' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })));
