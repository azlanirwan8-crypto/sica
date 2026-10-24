import http from 'node:http';

const paths = ['/', '/login', '/dashboard', '/api/v1/health', '/_next/static/css/app/layout.css'];

function get(p) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: 3000, path: p, timeout: 45000 }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ p, status: res.statusCode, len: body.length, body }));
    });
    req.on('error', (e) => resolve({ p, status: 'ERR ' + e.code, len: 0, body: '' }));
    req.on('timeout', () => { req.destroy(); resolve({ p, status: 'TIMEOUT', len: 0, body: '' }); });
  });
}

for (const p of paths) {
  const r = await get(p);
  console.log(p + ' -> ' + r.status + ' (' + r.len + ' bytes)');
  if (r.status === 500 || r.status === 404 || String(r.status).startsWith('ERR')) {
    const msgs = (r.body.match(/[A-Z][a-zA-Z]*Error[^\n\\]{0,240}/g) ?? []).slice(0, 4);
    msgs.forEach((m) => console.log('    ' + m));
  }
}
