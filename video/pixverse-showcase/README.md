# Showcase PixVerse Plugin (motion graphic 9:16)

Video motion graphic 40 detik untuk kampanye PixVerse Earn. Urutannya mengikuti panduan kampanye: hasil jadi ditampilkan dulu, lalu alur kerja, tools, dan ajakan mencoba plugin.

| Detik | Adegan | Isi |
|---|---|---|
| 0–3 | Hook | "One prompt. One agent. A full anime football film." |
| 3–18 | Hasil | **Slot A**: klip PixVerse asli, layar penuh, dengan label "Made with Agent + PixVerse plugin" |
| 18–19,5 | Transisi | "How I made it" |
| 19,5–31,5 | Alur kerja | **Slot B**: rekaman layar asli di dalam jendela, ditambah kartu langkah 01–04 |
| 31,5–34,5 | Tools | Claude Code dan PixVerse plugin |
| 34,5–40 | CTA | "Try the PixVerse plugin", URL, #PixVersePlugin |

## Cara pakai

```bash
# Pratinjau (slot diisi gambar contoh)
node video/pixverse-showcase/buat-video.mjs

# Versi final dengan klip asli
node video/pixverse-showcase/buat-video.mjs \
  --hasil hasil-pixverse.mp4 \
  --rekaman rekaman-layar.mp4 \
  --musik lagu.mp3            # opsional
```

Output masuk ke `kantor/konten/pixverse/` (di-gitignore). Render butuh sekitar 3–5 menit.

- `--hasil`: video 9:16 hasil PixVerse. Dipotong agar memenuhi layar dan diulang kalau kurang dari 15 detik. Suaranya ikut dipakai (matikan dengan `--tanpa-suara-hasil`).
- `--rekaman`: rekaman layar saat memberi prompt ke agent dan plugin bekerja. Diskalakan agar muat di jendela 940×640 dan diulang kalau kurang dari 12 detik. Sebaiknya potong dulu jadi bagian penting (prompt, proses render, hasil keluar).
- `--musik`: dipotong ke 40 detik dengan fade in/out. Bisa juga dilewati lalu tambah musik di Instagram.

Semua teks (prompt contoh, judul film, langkah, tools) ada di `CONFIG` di bagian atas `motion.html`. Sesuaikan dengan prompt dan langkah yang benar-benar dipakai. Buka `motion.html` di browser untuk melihat pratinjau langsung.

Gaya visual: judul dua baris (Inter Display tebal + Instrument Serif miring), kartu melayang dan miring, warna PixVerse (hitam + gradasi krem, oranye, pink, ungu). Font Instrument Serif ada di `fonts/` (lisensi SIL OFL, lihat `fonts/OFL.txt`).
