/**
 * Inti pemrosesan gambar. Dipakai di Web Worker (lewat importScripts) dan di main thread
 * sebagai cadangan, jadi hanya boleh memakai API yang ada di keduanya.
 */
(function (g) {
  const TOO_BIG = 'Resolusi terlalu besar untuk diproses browser. Coba perkecil ukuran.';
  const THUMB = 112; // px, 2x ukuran tampilan thumbnail

  /** Ukuran hasil. Rasio selalu dijaga dan gambar tidak pernah diperbesar. */
  function targetSize(sw, sh, resize) {
    const v = resize?.value || 0;
    let scale = 1;
    if (resize && v > 0) {
      if (resize.mode === 'percent') scale = v / 100;
      else if (resize.mode === 'width') scale = v / sw;
      else if (resize.mode === 'height') scale = v / sh;
      else if (resize.mode === 'long') scale = v / Math.max(sw, sh);
    }
    scale = Math.min(1, scale);
    return { width: Math.max(1, Math.round(sw * scale)), height: Math.max(1, Math.round(sh * scale)) };
  }

  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function toBlob(canvas, mime, quality) {
    if (canvas.convertToBlob) return canvas.convertToBlob({ type: mime, quality });
    return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
  }

  /**
   * src: ImageBitmap atau <img>. o: { mime, quality (1-100), background, resize }.
   * Return { blob, thumb, width, height, srcWidth, srcHeight }.
   */
  async function process(src, sw, sh, o) {
    const { width, height } = targetSize(sw, sh, o.resize);
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(TOO_BIG);
    if (o.background) {
      ctx.fillStyle = o.background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, width, height);

    let blob;
    try {
      blob = await toBlob(canvas, o.mime, o.quality / 100);
    } catch (_) {
      blob = null;
    }
    if (!blob) throw new Error(TOO_BIG);
    if (blob.type !== o.mime) throw new Error('Browser ini tidak bisa membuat format ' + o.mime.split('/')[1].toUpperCase() + '.');

    // Thumbnail kecil dari hasil, supaya daftar file tidak perlu men-decode gambar besar.
    const ts = Math.min(1, THUMB / Math.max(width, height));
    const tc = makeCanvas(Math.max(1, Math.round(width * ts)), Math.max(1, Math.round(height * ts)));
    const tctx = tc.getContext('2d');
    tctx.imageSmoothingQuality = 'high';
    tctx.drawImage(canvas, 0, 0, tc.width, tc.height);
    const thumb = await toBlob(tc, 'image/webp', 0.75).catch(() => null);

    canvas.width = canvas.height = 0; // bebaskan memori canvas lebih cepat
    return { blob, thumb, width, height, srcWidth: sw, srcHeight: sh };
  }

  g.HTImageCore = { targetSize, process, TOO_BIG };
})(self);
