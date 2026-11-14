import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dir, '../dist');
const outDir = path.resolve(__dir, '../screenshots');

fs.mkdirSync(outDir, { recursive: true });

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(distDir, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(5234, () => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-ss-'));

  const targets = [
    { name: 'dashboard-380px-light.png', width: 380, height: 820, theme: 'light' },
    { name: 'dashboard-380px-dark.png', width: 380, height: 820, theme: 'dark' },
    { name: 'dashboard-1280px-light.png', width: 1280, height: 850, theme: 'light' },
    { name: 'dashboard-1280px-dark.png', width: 1280, height: 850, theme: 'dark' },
  ];

  for (const t of targets) {
    const outFile = path.join(outDir, t.name);
    const url = `http://localhost:5234/${t.theme === 'dark' ? '?theme=dark' : ''}`;
    try {
      execSync(
        `"${edgePath}" --headless=new --no-sandbox --no-first-run --no-default-browser-check --disable-gpu --disable-software-rasterizer --disable-extensions --user-data-dir="${tmpDir}" --window-size=${t.width},${t.height} --screenshot="${outFile}" "${url}"`,
        { timeout: 15000, stdio: 'ignore' }
      );
      console.log(`Saved: ${t.name}`);
    } catch (e) {
      console.error(`Failed ${t.name}:`, e.message);
    }
  }

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}

  server.close(() => {
    process.exit(0);
  });
});
