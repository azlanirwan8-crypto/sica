import http from 'node:http';

const path = process.argv[2] ?? '/login';

http.get({ host: '127.0.0.1', port: 3000, path, timeout: 30000 }, (res) => {
  let body = '';
  res.on('data', (c) => { body += c; });
  res.on('end', () => {
    console.log('status=' + res.statusCode + ' bytes=' + body.length);
    const stripped = body
      .replace(/<script[^>]*>/g, '\n')
      .replace(/<\/script>/g, '\n')
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/\\n/g, '\n');
    const hits = stripped.match(/[A-Z][a-zA-Z]*Error[^\n]{0,300}/g) ?? [];
    console.log('--- pesan error ---');
    hits.slice(0, 10).forEach((h) => console.log(h.slice(0, 300)));
    if (!hits.length) {
      console.log('(tidak ada pola Error; cuplikan mentah)');
      console.log(body.slice(0, 1500));
    }
  });
}).on('error', (e) => console.log('ERR ' + e.code));
