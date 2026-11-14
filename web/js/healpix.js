// HEALPix, nested scheme: which sky-map tile contains a given direction.
// Sky maps (HiPS) are cut into HEALPix tiles; knowing the tile numbers lets the app fetch the
// tiles of a view ahead of time, so the guided tour can run from the device's own storage.

/** Spread the bits of v apart: bit i moves to bit 2i. */
function spread(v) {
  let r = 0;
  for (let i = 0; i < 16; i++) r += ((v >> i) & 1) * Math.pow(4, i);
  return r;
}

/** Pixel index (nested) at the given order for a direction in degrees. */
export function ang2pix(order, raDeg, decDeg) {
  const nside = 1 << order, z = Math.sin(decDeg * Math.PI / 180), za = Math.abs(z);
  const tt = (((raDeg / 90) % 4) + 4) % 4;                // longitude in units of 90 degrees, [0, 4)
  let face, ix, iy;
  if (za <= 2 / 3) {                                      // equatorial belt
    const t1 = nside * (0.5 + tt), t2 = nside * z * 0.75;
    const jp = Math.floor(t1 - t2), jm = Math.floor(t1 + t2);
    const ifp = Math.floor(jp / nside), ifm = Math.floor(jm / nside);
    face = ifp === ifm ? (ifp & 3) + 4 : ifp < ifm ? (ifp & 3) : (ifm & 3) + 8;
    ix = jm & (nside - 1); iy = nside - (jp & (nside - 1)) - 1;
  } else {                                                // polar caps
    const ntt = Math.min(3, Math.floor(tt)), tp = tt - ntt, tmp = nside * Math.sqrt(3 * (1 - za));
    const jp = Math.min(nside - 1, Math.floor(tp * tmp)), jm = Math.min(nside - 1, Math.floor((1 - tp) * tmp));
    if (z >= 0) { face = ntt; ix = nside - jm - 1; iy = nside - jp - 1; }
    else { face = ntt + 8; ix = jp; iy = jm; }
  }
  return face * nside * nside + spread(ix) + 2 * spread(iy);
}

/** Address of a HiPS tile; cubes carry the frame number after the pixel number. */
export function tileUrl(base, order, pix, frame = null, ext = 'png') {
  return `${base}/Norder${order}/Dir${Math.floor(pix / 10000) * 10000}/Npix${pix}${frame === null ? '' : `_${frame}`}.${ext}`;
}

/** The display order a sky map is shown at: its pixels no coarser than the screen's. */
export function orderFor(fovDeg, widthPx, maxOrder, tileWidth = 512) {
  const want = Math.ceil(Math.log2(58.6323 * widthPx / (tileWidth * fovDeg)));
  return Math.max(0, Math.min(maxOrder, want));
}

/**
 * Tiles needed to show a view of the sky drawn as a globe (orthographic projection):
 * centre in degrees, width of the view in degrees, size of the view in pixels.
 * Returns [order, pixel] pairs for the display order and, optionally, its parent.
 */
export function tilesInView(ra0, dec0, fovDeg, W, H, maxOrder, withParent = false) {
  const top = orderFor(fovDeg, W, maxOrder), out = new Map();
  const r = Math.PI / 180, a0 = ra0 * r, d0 = dec0 * r, half = Math.sin(Math.min(fovDeg, 179) / 2 * r) * 1.12, N = 16;
  for (let o = withParent ? Math.max(0, top - 1) : top; o <= top; o++) {
    for (let j = -N; j <= N; j++) for (let i = -N; i <= N; i++) {
      const X = half * i / N, Y = half * (H / W) * j / N, rho = Math.hypot(X, Y);
      if (rho >= 1) continue;
      let ra = ra0, dec = dec0;
      if (rho > 0) {
        const c = Math.asin(rho);
        dec = Math.asin(Math.cos(c) * Math.sin(d0) + Y * Math.sin(c) * Math.cos(d0) / rho) / r;
        ra = (a0 + Math.atan2(X * Math.sin(c), rho * Math.cos(d0) * Math.cos(c) - Y * Math.sin(d0) * Math.sin(c))) / r;
      }
      const pix = ang2pix(o, ra, dec);
      out.set(`${o}/${pix}`, [o, pix]);
    }
  }
  return [...out.values()];
}
