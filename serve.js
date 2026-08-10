const http = require('http');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname);
const port = 3000;

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.join(dir, urlPath === '/' ? 'HMI.html' : urlPath);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.log(`  [404] ${urlPath}`);
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    console.log(`  [200] ${urlPath}`);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log('');
  console.log('==========================================');
  console.log(`  HMI Analyser is live at:`);
  console.log(`  http://localhost:${port}`);
  console.log('==========================================');
  console.log('');
  console.log('Waiting for requests...');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`ERROR: Port ${port} is already in use. Close the other server first.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
