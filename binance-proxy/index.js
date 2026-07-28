const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  const opts = {
    hostname: 'api.binance.com',
    port: 443,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: 'api.binance.com' },
  };
  delete opts.headers['x-forwarded-for'];

  const pr = https.request(opts, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  pr.on('error', (e) => { res.writeHead(502); res.end(e.message); });
  req.pipe(pr);
}).listen(PORT, () => console.log(`Binance proxy on :${PORT}`));
