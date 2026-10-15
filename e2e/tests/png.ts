import { crc32, deflateSync } from 'node:zlib';

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
