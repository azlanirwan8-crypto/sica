import http from 'node:http';

http.get({ host: '127.0.0.1', port: 3000, path: '/login', timeout: 45000 }, (res) => {
  let body = '';
  res.on('data', (c) => { body += c; });
  res.on('end', () => {
    const pretty = body.replace(/\\u001b\[[0-9;]*m/g, '').replace(/\\n/g, '\n').replace(/\\t/g, '  ');
    const msgIdx = pretty.indexOf('"message"');
    if (msgIdx >= 0) {
      console.log('--- message ---');
      console.log(pretty.slice(msgIdx, msgIdx + 1800));
    }
    const locIdx = pretty.indexOf('"loc"');
    if (locIdx >= 0) console.log('--- loc ---\n' + pretty.slice(locIdx, locIdx + 300));
    console.log('--- frame ---');
    const frameStart = pretty.indexOf('>', Math.max(0, msgIdx - 100));
    console.log(pretty.slice(msgIdx, msgIdx).length ? '' : pretty.slice(0, 400));
  });
}).on('error', (e) => console.log('ERR ' + e.code));
