import { crc32, deflateSync, inflateSync } from 'node:zlib';

// Encodes an RGB gradient as a PNG, so the seam carver has distinct seams to remove
export function gradientPng(width: number, height: number): Buffer {
    const rows = [];
    for (let y = 0; y < height; y++) {
        const row = Buffer.alloc(1 + width * 3); // Leading 0 selects no filter
        for (let x = 0; x < width; x++) {
            row.writeUInt8((x * 255 / width) | 0, 1 + x * 3);
            row.writeUInt8((y * 255 / height) | 0, 2 + x * 3);
            row.writeUInt8(((x + y) * 7) % 256, 3 + x * 3);
        }
        rows.push(row);
    }

    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header.writeUInt8(8, 8); // Bit depth
    header.writeUInt8(2, 9); // Truecolour

    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(Buffer.concat(rows))),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

function chunk(type: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData));
    return Buffer.concat([length, typeAndData, crc]);
}

// A decoded image: RGBA8 pixels, rows top to bottom
export interface Pixels {
    width: number,
    height: number,
    rgba: Uint8Array,
}

// Decodes an 8-bit, non-interlaced RGB or RGBA PNG (as ZGAL's captures and test images are), so a
// spec can compare a page's output with a reference
export function decodePng(png: Buffer): Pixels {
    if (!png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        throw new Error('not a PNG');
    }
    let width = 0, height = 0, channels = 0;
    const data: Buffer[] = [];
    for (let at = 8; at < png.length;) {
        const length = png.readUInt32BE(at);
        const type = png.toString('ascii', at + 4, at + 8);
        const body = png.subarray(at + 8, at + 8 + length);
        if (type === 'IHDR') {
            width = body.readUInt32BE(0);
            height = body.readUInt32BE(4);
            const [depth, colour, , , interlace] = body.subarray(8, 13);
            channels = { 2: 3, 6: 4 }[colour as 2 | 6] ?? 0;
            if (depth !== 8 || channels === 0 || interlace !== 0) {
                throw new Error(`unsupported PNG: depth ${depth}, colour type ${colour}, interlace ${interlace}`);
            }
        } else if (type === 'IDAT') {
            data.push(body);
        }
        at += 12 + length;
    }

    const raw = inflateSync(Buffer.concat(data));
    const stride = width * channels;
    const rows = new Uint8Array(height * stride);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        const row = y * stride;
        for (let x = 0; x < stride; x++) {
            const left = x >= channels ? rows[row + x - channels] : 0;
            const up = y > 0 ? rows[row - stride + x] : 0;
            const upLeft = y > 0 && x >= channels ? rows[row - stride + x - channels] : 0;
            rows[row + x] = (line[x] + [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter]) & 0xff;
        }
    }

    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        for (let c = 0; c < 4; c++) {
            rgba[i * 4 + c] = c < channels ? rows[i * channels + c] : 255;
        }
    }
    return { width, height, rgba };
}

function paeth(left: number, up: number, upLeft: number): number {
    const estimate = left + up - upLeft;
    const [a, b, c] = [Math.abs(estimate - left), Math.abs(estimate - up), Math.abs(estimate - upLeft)];
    return a <= b && a <= c ? left : b <= c ? up : upLeft;
}
