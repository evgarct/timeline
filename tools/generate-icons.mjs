import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const pngTargets = [
  ["public/favicon-32x32.png", 32],
  ["public/favicon-16x16.png", 16],
  ["public/apple-touch-icon.png", 180],
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
  ["public/icon-maskable-512.png", 512]
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="70" y1="36" x2="438" y2="474" gradientUnits="userSpaceOnUse">
      <stop stop-color="#f4d8c7"/>
      <stop offset=".52" stop-color="#e8efdc"/>
      <stop offset="1" stop-color="#d4e6ee"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="162" fill="#211d19" opacity=".92"/>
  <path d="M174 318c48-76 103-76 164 0" fill="none" stroke="#f8f4ee" stroke-width="30" stroke-linecap="round"/>
  <path d="M256 154v218" fill="none" stroke="#f8f4ee" stroke-width="28" stroke-linecap="round"/>
  <circle cx="256" cy="150" r="34" fill="#f8f4ee"/>
  <circle cx="174" cy="318" r="19" fill="#f8f4ee"/>
  <circle cx="338" cy="318" r="19" fill="#f8f4ee"/>
</svg>
`;

writeFileSync("public/icon.svg", svg);
writeFileSync("public/favicon.svg", svg);
for (const [file, size] of pngTargets) {
  writeFileSync(file, makePng(size));
}

function makePng(size) {
  const data = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    data[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const index = row + 1 + x * 4;
      const pixel = colorAt(x / (size - 1), y / (size - 1), size);
      data[index] = pixel[0];
      data[index + 1] = pixel[1];
      data[index + 2] = pixel[2];
      data[index + 3] = pixel[3];
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", Buffer.from([
      ...u32(size),
      ...u32(size),
      8,
      6,
      0,
      0,
      0
    ])),
    chunk("IDAT", deflateSync(data)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function colorAt(x, y, size) {
  const radius = roundedSquareAlpha(x, y);
  const bg = mix(mix([244, 216, 199], [232, 239, 220], x), [212, 230, 238], y * 0.72);
  if (radius < 1) return [...bg, Math.round(255 * radius)];
  const cx = x - 0.5;
  const cy = y - 0.5;
  const distance = Math.hypot(cx, cy);
  let color = bg;
  if (distance < 0.316) color = [33, 29, 25];
  const lineWidth = size < 64 ? 0.044 : 0.034;
  const isBody = Math.abs(x - 0.5) < lineWidth && y > 0.3 && y < 0.73;
  const isHead = Math.hypot(x - 0.5, y - 0.293) < 0.066;
  const isArc = Math.abs(Math.hypot((x - 0.5) / 0.33, (y - 0.62) / 0.23) - 1) < 0.072 && y > 0.51;
  const isDot = Math.hypot(x - 0.34, y - 0.62) < 0.038 || Math.hypot(x - 0.66, y - 0.62) < 0.038;
  if (isBody || isHead || isArc || isDot) color = [248, 244, 238];
  return [...color, 255];
}

function roundedSquareAlpha(x, y) {
  const radius = 0.22;
  const edge = 0.5 - radius;
  const dx = Math.max(Math.abs(x - 0.5) - edge, 0);
  const dy = Math.max(Math.abs(y - 0.5) - edge, 0);
  const distance = Math.hypot(dx, dy);
  if (distance <= radius) return 1;
  return Math.max(0, 1 - (distance - radius) * 180);
}

function mix(left, right, amount) {
  return left.map((value, index) => Math.round(value * (1 - amount) + right[index] * amount));
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  return Buffer.concat([
    Buffer.from(u32(data.length)),
    typeBuffer,
    data,
    Buffer.from(u32(crc32(Buffer.concat([typeBuffer, data]))))
  ]);
}

function u32(value) {
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
