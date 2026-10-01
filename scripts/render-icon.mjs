import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const size = 512

function crc(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i]
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc(body), 8 + data.length)
  return out
}

function roundRect(px, py, side, radius) {
  const x = Math.abs(px - side / 2)
  const y = Math.abs(py - side / 2)
  const qx = x - (side / 2 - radius)
  const qy = y - (side / 2 - radius)
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius
}

function inTriangle(px, py) {
  const points = [
    [188, 146],
    [188, 366],
    [364, 256]
  ]
  const [x1, y1] = points[0]
  const [x2, y2] = points[1]
  const [x3, y3] = points[2]
  const d = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3)
  const a = ((y2 - y3) * (px - x3) + (x3 - x2) * (py - y3)) / d
  const b = ((y3 - y1) * (px - x3) + (x1 - x3) * (py - y3)) / d
  const c = 1 - a - b
  return a >= 0 && b >= 0 && c >= 0
}

function sample(x, y) {
  let cover = 0
  let play = 0
  for (const [ox, oy] of [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75]
  ]) {
    const px = x + ox
    const py = y + oy
    if (roundRect(px, py, size, 112) <= 0) cover += 1
    if (inTriangle(px, py)) play += 1
  }
  const blue = [47, 120, 255]
  if (play > 0) return [255, 255, 255, Math.round((play / 4) * 255)]
  return [...blue, Math.round((cover / 4) * 255)]
}

const raw = Buffer.alloc((size * 4 + 1) * size)
for (let y = 0; y < size; y += 1) {
  const row = y * (size * 4 + 1)
  raw[row] = 0
  for (let x = 0; x < size; x += 1) {
    const [r, g, b, a] = sample(x, y)
    const i = row + 1 + x * 4
    raw[i] = r
    raw[i + 1] = g
    raw[i + 2] = b
    raw[i + 3] = a
  }
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(size, 0)
ihdr.writeUInt32BE(size, 4)
ihdr[8] = 8
ihdr[9] = 6
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0))
])

mkdirSync('build', { recursive: true })
writeFileSync('build/icon.png', png)
