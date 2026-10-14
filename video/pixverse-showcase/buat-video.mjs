// Render motion graphic showcase PixVerse ke MP4 9:16.
//
// Pratinjau (slot diisi gambar contoh):
//   node buat-video.mjs
// Versi final dengan klip asli:
//   node buat-video.mjs --hasil hasil-pixverse.mp4 --rekaman rekaman-layar.mp4 [--musik lagu.mp3]
// Opsi lain: --out file.mp4  --fps 30  --dari 0 --sampai 46 (render sebagian untuk cek cepat)
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(resolve(spawnSync('npm', ['root', '-g']).stdout.toString().trim(), 'playwright'))); }

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) =>
  v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a, []));
const fps = Number(args.fps || 30);
const outDir = resolve(here, '../../kantor/konten/pixverse');
mkdirSync(outDir, { recursive: true });
const final = Boolean(args.hasil || args.rekaman);
const out = resolve(args.out || `${outDir}/${final ? 'showcase-final' : 'showcase-preview'}.mp4`);
for (const k of ['hasil', 'rekaman', 'musik']) if (args[k] && !existsSync(args[k])) throw new Error(`File --${k} tidak ditemukan: ${args[k]}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 700 } });
await page.goto(pathToFileURL(resolve(here, 'motion.html')).href);
await page.evaluate(() => window.ready);
const { TL, SLOT_A, SLOT_B } = await page.evaluate(() => window.TIMELINE);
const t0 = Number(args.dari || 0), t1 = Math.min(TL.duration, Number(args.sampai || TL.duration));
const frames = Math.round((t1 - t0) * fps);

// Mode layer = PNG beralpha (slot transparan) untuk ditumpuk di atas klip asli.
const mode = final ? 'layer' : 'preview';
const mgFile = final ? `${outDir}/_mg-layer.mov` : out;
const enc = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
  ...(final ? ['-c:v', 'qtrle'] : ['-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']),
  mgFile], { stdio: ['pipe', 'inherit', 'inherit'] });

const type = final ? 'image/png' : 'image/jpeg';
for (let i = 0; i < frames; i++) {
  const url = await page.evaluate(([t, m, ty]) => window.renderFrame(t, m, ty, 0.95), [t0 + i / fps, mode, type]);
  const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  if (!enc.stdin.write(buf)) await new Promise(r => enc.stdin.once('drain', r));
  if (i % fps === 0) process.stdout.write(`\rframe ${i}/${frames}`);
}
enc.stdin.end();
await new Promise((r, j) => enc.on('close', c => c === 0 ? r() : j(new Error('ffmpeg gagal: ' + c))));
await browser.close();
console.log(`\rframe ${frames}/${frames}`);

if (final) {
  // Susun: latar hitam → klip hasil (slot A) → rekaman layar (slot B) → lapisan motion graphic.
  const inputs = ['-i', mgFile, '-f', 'lavfi', '-i', `color=c=black:s=1080x1920:r=${fps}:d=${t1 - t0}`];
  const f = [];
  let base = '[1:v]', n = 2;
  const place = (file, slot, [a, b], fit) => {
    if (!file) return null;
    inputs.push('-stream_loop', '-1', '-i', file);
    const s = `${slot.w}:${slot.h}`;
    const scale = fit === 'fill'
      ? `scale=${s}:force_original_aspect_ratio=increase:flags=lanczos,crop=${s}`
      : `scale=${s}:force_original_aspect_ratio=decrease,pad=${s}:(ow-iw)/2:(oh-ih)/2:color=0x0B0F1A`;
    f.push(`[${n}:v]${scale},setsar=1,fps=${fps},trim=duration=${b - a},setpts=PTS-STARTPTS+${a - t0}/TB[s${n}]`);
    f.push(`${base}[s${n}]overlay=${slot.x}:${slot.y}:eof_action=pass:enable='between(t,${a - t0},${b - t0})'[u${n}]`);
    base = `[u${n}]`; return n++;
  };
  const hasilIdx = place(args.hasil, SLOT_A, TL.result, 'fill');
  place(args.rekaman, SLOT_B, [TL.work[0] - 0.3, TL.work[1]], 'fit');
  f.push(`${base}[0:v]overlay=0:0:format=auto,format=yuv420p[v]`);
  // Audio: suara klip hasil (hujan, penonton, tendangan) di slot A, ditambah musik kalau ada.
  const dur = t1 - t0, tracks = [];
  const hasAudio = file => spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file]).stdout.toString().trim() !== '';
  if (hasilIdx !== null && !args['tanpa-suara-hasil'] && hasAudio(args.hasil)) {
    const [a, b] = TL.result, ms = Math.max(0, Math.round((a - t0) * 1000));
    f.push(`[${hasilIdx}:a]atrim=0:${b - a},asetpts=PTS-STARTPTS,afade=t=out:st=${b - a - 0.5}:d=0.5,adelay=${ms}:all=1,apad[ah]`);
    tracks.push('[ah]');
  }
  if (args.musik) {
    inputs.push('-i', args.musik);
    const vol = tracks.length ? 0.35 : 1; // musik lebih pelan kalau ada suara klip
    f.push(`[${n}:a]atrim=0:${dur},volume=${vol},afade=t=in:d=0.5,afade=t=out:st=${dur - 1.5}:d=1.5,apad[am]`);
    tracks.push('[am]');
  }
  const audio = [];
  if (tracks.length) {
    f.push(`${tracks.join('')}amix=inputs=${tracks.length}:normalize=0:duration=longest,atrim=0:${dur}[a]`);
    audio.push('-map', '[a]', '-c:a', 'aac', '-b:a', '192k');
  }
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', f.join(';'),
    '-map', '[v]', ...audio, '-t', String(t1 - t0), '-c:v', 'libx264', '-preset', 'medium', '-crf', '21',
    '-movflags', '+faststart', out], { stdio: 'inherit' });
  rmSync(mgFile, { force: true }); // layer sementara bisa beberapa GB
  if (r.status !== 0) throw new Error('ffmpeg gagal menyusun video final');
}
console.log('Selesai:', out);
