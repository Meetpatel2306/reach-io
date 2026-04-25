const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size) {
  const w = size, h = size;
  const raw = Buffer.alloc(h * (1 + w * 4));
  const radius = Math.floor(size * 0.234);

  // Lightning bolt polygon points (normalized 0-1)
  const bolt = [
    [0.5625, 0.14], [0.30, 0.52], [0.46, 0.52],
    [0.38, 0.86], [0.70, 0.44], [0.54, 0.44], [0.5625, 0.14]
  ];

  function pointInPolygon(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    for (let x = 0; x < w; x++) {
      const off = y * (1 + w * 4) + 1 + x * 4;

      // Rounded rect check
      let inside = true;
      if (x < radius && y < radius) inside = (x - radius) ** 2 + (y - radius) ** 2 <= radius ** 2;
      else if (x >= w - radius && y < radius) inside = (x - (w - radius - 1)) ** 2 + (y - radius) ** 2 <= radius ** 2;
      else if (x < radius && y >= h - radius) inside = (x - radius) ** 2 + (y - (h - radius - 1)) ** 2 <= radius ** 2;
      else if (x >= w - radius && y >= h - radius) inside = (x - (w - radius - 1)) ** 2 + (y - (h - radius - 1)) ** 2 <= radius ** 2;

      if (!inside) { raw[off] = 0; raw[off+1] = 0; raw[off+2] = 0; raw[off+3] = 0; continue; }

      // Background gradient
      const t = (x + y) / (w + h);
      let cr = Math.round(167 + (139 - 167) * t); // #a78bfa -> #8b5cf6
      let cg = Math.round(139 + (92 - 139) * t);
      let cb = Math.round(250 + (246 - 250) * t);

      // Lightning bolt
      const nx = x / w, ny = y / h;
      if (pointInPolygon(nx, ny, bolt)) { cr = 255; cg = 255; cb = 255; }

      raw[off] = cr; raw[off+1] = cg; raw[off+2] = cb; raw[off+3] = 255;
    }
  }

  const compressed = zlib.deflateSync(raw);
  const chunks = [];
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  chunks.push(makeChunk('IHDR', ihdr));
  chunks.push(makeChunk('IDAT', compressed));
  chunks.push(makeChunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const tb = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tb, data])));
  return Buffer.concat([len, tb, data, crc]);
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0); }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const dir = path.join(__dirname, '..', 'public', 'icons');
[192, 512].forEach(s => {
  const png = createPNG(s);
  fs.writeFileSync(path.join(dir, `icon-${s}.png`), png);
  console.log(`icon-${s}.png (${png.length} bytes)`);
});
console.log('Done!');
