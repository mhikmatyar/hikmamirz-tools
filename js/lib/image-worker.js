// Worker pemrosesan gambar: decode, resize, dan encode tanpa membebani halaman.
importScripts('image-core.js');

self.onmessage = async (e) => {
  const { id, file, options } = e.data;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (_) {
    // Format yang tidak bisa di-decode di worker (mis. SVG) dikerjakan di halaman.
    self.postMessage({ id, fallback: true });
    return;
  }
  try {
    const result = await HTImageCore.process(bitmap, bitmap.width, bitmap.height, options);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: err?.message || 'Gagal memproses gambar.' });
  } finally {
    bitmap.close();
  }
};
