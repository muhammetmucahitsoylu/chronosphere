// Rice decompression of one tile of a FITS tile-compressed image (ZCMPTYPE = 'RICE_1', 32-bit integers).
// SPHEREx stores the FLAGS layer of every exposure this way, one row of the detector per tile.
// Follows the reference algorithm of the FITS tiled-image convention (as in CFITSIO's fits_rdecomp);
// checked against Astropy on real exposures: every pixel of every row identical.

/**
 * @param {Uint8Array} bytes   the compressed bytes of one tile
 * @param {number} nx          number of pixels in the tile
 * @param {number} nblock      pixels per coding block (ZVAL1, normally 32)
 * @returns {Int32Array}
 */
export function riceDecode(bytes, nx, nblock = 32) {
  const out = new Int32Array(nx), FSBITS = 5, FSMAX = 25, BBITS = 32;
  if (bytes.length < 5) throw new Error('compressed tile too short');
  let p = 4, last = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];          // the first pixel, as it is
  let b = bytes[p++], nbits = 8;          // the bit buffer and how many of its bits are still unread
  for (let i = 0; i < nx;) {
    // how many low bits each difference in this block carries, less one
    nbits -= FSBITS;
    while (nbits < 0) { b = (b << 8) | bytes[p++]; nbits += 8; }
    const fs = (b >>> nbits) - 1;
    b &= (1 << nbits) - 1;
    const end = Math.min(i + nblock, nx);
    if (fs < 0) {
      for (; i < end; i++) out[i] = last;          // a block of equal pixels
    } else if (fs === FSMAX) {
      for (; i < end; i++) {                       // differences too wild to code: stored whole
        let k = BBITS - nbits, diff = k < 32 ? b << k : 0;
        for (k -= 8; k >= 0; k -= 8) { b = bytes[p++]; diff |= b << k; }
        if (nbits > 0) { b = bytes[p++]; diff |= b >>> (-k); b &= (1 << nbits) - 1; } else b = 0;
        diff = (diff & 1) === 0 ? diff >>> 1 : ~(diff >>> 1);
        last = out[i] = (diff + last) | 0;
      }
    } else {
      for (; i < end; i++) {
        while (b === 0) { nbits += 8; b = bytes[p++]; }
        const nzero = nbits - (32 - Math.clz32(b));          // zeros before the next one-bit
        nbits -= nzero + 1;
        b ^= 1 << nbits;                                    // take that one-bit away
        nbits -= fs;
        while (nbits < 0) { b = (b << 8) | bytes[p++]; nbits += 8; }
        let diff = (nzero << fs) | (b >>> nbits);
        b &= (1 << nbits) - 1;
        diff = (diff & 1) === 0 ? diff >>> 1 : ~(diff >>> 1);
        last = out[i] = (diff + last) | 0;
      }
    }
    if (p > bytes.length + 1) throw new Error('compressed tile ends early');
  }
  return out;
}
