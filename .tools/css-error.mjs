import http from 'node:http';

http.get({ host: '127.0.0.1', port: 3000, path: '/login', timeout: 45000 }, (res) => {
  let body = '';
  res.on('data', (c) => { body += c; });
  res.on('end', () => {
    const i = body.indexOf('CssError');
    console.log('status=' + res.statusCode + ' index=' + i);
    const chunk = body.slice(Math.max(0, i - 200), i + 2600);
    console.log(chunk.replace(/\\n/g, '\n').replace(/\\_/g, '_'));
  });
}).on('error', (e) => console.log('ERR ' + e.code));
