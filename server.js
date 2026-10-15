const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, 'public');
const rooms = new Map();
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const requested = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = path.resolve(publicDir, requested);
  if (!file.startsWith(publicDir + path.sep) && file !== path.join(publicDir, 'index.html')) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

const wss = new (require('node:events').EventEmitter)();
server.on('upgrade', (req, socket) => {
  if (req.url !== '/signal') return socket.destroy();
  const key = req.headers['sec-websocket-key'];
  if (!key || req.headers.upgrade?.toLowerCase() !== 'websocket') return socket.destroy();
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  let buffer = Buffer.alloc(0);
  socket.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const opcode = buffer[0] & 15;
      let length = buffer[1] & 127, offset = 2;
      if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
      else if (length === 127) { if (buffer.length < 10) return; const n = buffer.readBigUInt64BE(2); if (n > 2_000_000n) return socket.destroy(); length = Number(n); offset = 10; }
      const masked = !!(buffer[1] & 128);
      if (masked) offset += 4;
      if (buffer.length < offset + length) return;
      let payload = buffer.subarray(offset, offset + length);
      if (masked) { const mask = buffer.subarray(offset - 4, offset); payload = Buffer.from(payload); for (let i = 0; i < length; i++) payload[i] ^= mask[i % 4]; }
      buffer = buffer.subarray(offset + length);
      if (opcode === 8) { socket.end(); return; }
      if (opcode === 1) handleMessage(socket, payload.toString());
    }
  });
  socket.on('close', () => removePeer(socket));
  socket.on('error', () => removePeer(socket));
  socket.on('pong', () => {});
  socket.sendText = obj => sendFrame(socket, Buffer.from(JSON.stringify(obj)), 1);
});

function sendFrame(socket, payload, opcode = 1) {
  if (socket.destroyed) return;
  let header;
  if (payload.length < 126) { header = Buffer.from([0x80 | opcode, payload.length]); }
  else if (payload.length <= 65535) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(payload.length, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(payload.length), 2); }
  socket.write(Buffer.concat([header, payload]));
}
function handleMessage(socket, raw) {
  let msg; try { msg = JSON.parse(raw); } catch { return; }
  if (msg.type === 'join') {
    const roomId = String(msg.room || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 24);
    if (!roomId) return socket.sendText({ type: 'error', message: 'Mã phòng không hợp lệ.' });
    let peers = rooms.get(roomId);
    if (!peers) rooms.set(roomId, peers = new Set());
    if (peers.size >= 2) return socket.sendText({ type: 'error', message: 'Phòng đã đủ 2 thiết bị.' });
    socket.roomId = roomId; peers.add(socket);
    socket.sendText({ type: 'joined', count: peers.size });
    if (peers.size === 2) for (const peer of peers) if (peer !== socket) peer.sendText({ type: 'peer-joined' });
  } else if (socket.roomId && ['offer', 'answer', 'candidate'].includes(msg.type)) {
    for (const peer of rooms.get(socket.roomId) || []) if (peer !== socket) peer.sendText(msg);
  }
}
function removePeer(socket) {
  const id = socket.roomId; if (!id) return;
  const peers = rooms.get(id); if (!peers) return;
  peers.delete(socket); for (const peer of peers) peer.sendText({ type: 'peer-left' });
  if (!peers.size) rooms.delete(id);
}
function getAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const net of list || []) if (net.family === 'IPv4' && !net.internal) out.push(net.address);
  return out;
}
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nWiFi File Drop dang chay tai:`);
  console.log(`  Tren may nay: http://localhost:${PORT}`);
  for (const ip of getAddresses()) console.log(`  Cung Wi-Fi:   http://${ip}:${PORT}`);
  console.log('\nNhan Ctrl+C de dung server.');
});

