// Generates placeholder icons (no dependencies). Replace assets/icon.png with your own artwork any time.
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function crc32(buf) {
  let crc = ~0;
  for (const b of buf) { crc ^= b; for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1; }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, pixel) {
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = pixel(x, y);
      raw.set([r, g, b, a], y * (1 + w * 4) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// signed distance to a rounded rectangle, then converted to 0..1 coverage
function cover(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r, qy = Math.abs(py - cy) - hh + r;
  const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  return Math.max(0, Math.min(1, 0.5 - d));
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// three "lyric lines", the middle one is the active line
function bars(N) {
  const h = N * 0.075, left = N * 0.24;
  return [
    { y: N * 0.34, w: N * 0.52, c: [246, 239, 228] },
    { y: N * 0.5, w: N * 0.38, c: [243, 196, 107] },
    { y: N * 0.66, w: N * 0.46, c: [246, 239, 228] }
  ].map((b) => ({ cx: left + b.w / 2, cy: b.y, hw: b.w / 2, hh: h / 2, r: h / 2, c: b.c }));
}

function appIcon(N) {
  const B = bars(N);
  return png(N, N, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    const a0 = cover(px, py, N / 2, N / 2, N / 2, N / 2, N * 0.22);
    let col = mix([34, 30, 58], [20, 17, 32], y / N);
    for (const b of B) col = mix(col, b.c, cover(px, py, b.cx, b.cy, b.hw, b.hh, b.r));
    return [...col, Math.round(a0 * 255)];
  });
}
function trayIcon(N) {
  const B = bars(N);
  return png(N, N, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    const a = Math.max(...B.map((b) => cover(px, py, b.cx - N * 0.04, b.cy, b.hw, b.hh * 1.3, b.r)));
    return [0, 0, 0, Math.round(a * 255)];
  });
}

const out = path.join(__dirname, '..', 'assets');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon.png'), appIcon(1024));
fs.writeFileSync(path.join(out, 'tray.png'), appIcon(32));
fs.writeFileSync(path.join(out, 'trayTemplate.png'), trayIcon(18));
fs.writeFileSync(path.join(out, 'trayTemplate@2x.png'), trayIcon(36));
console.log('icons written to assets/');
