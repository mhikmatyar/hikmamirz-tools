# Format Prompt Video @hikmamirz

Semua prompt visual untuk PixVerse, Syntx, atau Flova ditulis **per klip** dengan format di bawah, dalam bahasa Inggris. Dialog tetap bahasa Jepang dengan baris `Meaning:` sebagai panduan produksi. Subtitle dan overlay nama ditambahkan belakangan di CapCut, bukan di-generate.

## Aturan tetap

- **Gaya:** blok STYLE dan daftar "NOT ..." di bawah selalu disalin utuh.
- **Nama:** di dalam prompt pakai nama parodi. Nama yang sudah dipakai:
  - Harry Kane → HARRI KEIN
  - Alex Baena → ALEX BAINA
  - Oyarzabal → MIKEL OYARZABAR
  - Unai Simón → Unai Simo
  - Andoni Iraola → ANDONI IRAORA
  - Jürgen Klopp → JURGEN KLOP
  - Graham Potter → GRAHAM POTTA
  - Xavi → CHAVI
  - Lewis Koumas → LEWIS KUMAS
  - Cody Gakpo → CODY GAKUPO
  - Nama lain ada di skill `ai-anime-soccer`.

  Untuk karakter baru, usulkan nama parodinya dulu dan minta pengguna mengonfirmasi. Jangan berganti-ganti antara nama asli dan nama parodi dalam satu proyek.
- **Karakter:** semuanya ditulis sebagai "Fictional ...", lengkap dengan nomor punggung yang dikunci. Pemain lain cukup "GENERIC ... background only, no recognizable real-player likeness".
- **Character sheet:** buat sheet (gambar 16:9, 4 pose + 4 ekspresi) untuk karakter yang tampil di lebih dari satu klip atau akan muncul lagi. Karakter yang hanya bersuara tidak perlu sheet. Sheet diunggah sebagai referensi di tiap klip lewat blok CHARACTER REFERENCE.
- **Telepon/percakapan jarak jauh:** tampilkan sebagai split-screen ala manga (penelepon di panel atas, karakter utama di panel bawah, dua lokasi dengan pencahayaan berbeda, panel yang bicara lebih besar dan terang). Tambahkan blok SPLIT-SCREEN PHONE CALL, dan di negative prompt: both characters in the same room, merged panels, video call screen UI. Kalau AI menggabungkan panel, generate tiap panel terpisah lalu susun di CapCut.
- **Bola:** kalau bola terlihat, pakai gambar referensi bola yang diunggah.
- **Teks di layar:** tidak ada teks hasil generate kecuali yang memang diizinkan (scoreboard, nomor punggung). Nama, layar ponsel, dan subtitle ditambahkan di CapCut.
- **Audio:** tanpa musik latar. Hanya ambience dan SFX.
- **Ending:** tanpa fade to black, tanpa title card, tanpa kredit.
- **Timeline:** dipecah per rentang detik dan dipisahkan garis `-----`.

## Kerangka

```
TITLE:
<JUDUL KLIP>

DURATION:
<n> seconds

FORMAT:
<9:16 vertical / 16:9> cinematic anime football sequence.

STYLE:
Premium 2D Japanese football sports anime.
High-end modern TV anime production.
Crisp hand-drawn linework, clean flat cel-shading,
sharp cinematic lighting, dramatic shadows,
expressive anime facial acting, fluid 2D animation,
intense football choreography.

NOT photorealistic.
NOT live action.
NOT 3D.
NOT CGI.
NOT realistic 3D football.
NOT painterly.
NOT semi-realistic digital painting.
NOT AI-generated visual style.

STORY CONTINUITY:
<lanjutan dari klip sebelumnya, situasi saat ini, skor, aturan cerita yang wajib>

IMPORTANT:
<aksi kunci yang harus terlihat jelas, misal A → B → C>

CHARACTERS:
1. <NAMA PARODI> #<no>
Fictional <peran>.
<fisik, rambut, ekspresi, kostum + nomor>.
<fungsi di klip>.
...
N. GENERIC <...>
Background only.
No recognizable real-player likenesses.

CHARACTER REFERENCE:
Use the uploaded character sheets as the exact visual reference for:
- <nama karakter yang tampil di klip ini>
Preserve:
- exact face and hairline
- exact hair color
- exact outfit and number
- exact proportions

BALL REFERENCE:
Whenever the football is visible,
use the uploaded football reference image as the exact visual reference.
Preserve:
- exact ball colors
- exact panel design
- exact markings
- exact proportions

SCOREBOARD:
<ada/tidak, posisi, skor awal → akhir>

DIALOGUE RULE:
Japanese spoken dialogue ONLY.
No English subtitles.
No speech bubbles.
No generated captions.
"Meaning:" lines are production guidance only.
They must NOT appear visually.

AUDIO:
NO background music.
Use:
<daftar ambience dan SFX>

TIMELINE:

0–X SECONDS — <JUDUL BEAT>
<aksi, kamera>
<KARAKTER>:
「<dialog Jepang>」
Meaning:
"<arti>"

--------------------------------------------------
(beat berikutnya ...)

EMOTIONAL DIRECTION:
<Karakter>: <a → b → c>.

(opsional) SUPERNATURAL DIRECTION:
...

CAMERA DESIGN:
Use:
- <daftar shot>
Camera movement should feel like premium 2D anime,
not shaky handheld footage.

LIGHTING:
<waktu, sumber cahaya, perubahan cahaya>

CONTINUITY RULES:
<nama = nomor, siapa melakukan apa, larangan spesifik>

ENDING:
<frame terakhir>
No fade to black.
No title card.
No credits.

NEGATIVE PROMPT:
photorealistic, live action, realistic human skin,
3D render, CGI, Pixar, Unreal Engine, game graphics,
semi-realistic, painterly, oil painting, western comic,
AI-generated look, plastic skin,
real football broadcast footage,
real player likeness, celebrity likeness,
real club branding, real broadcaster logo,
wrong jersey number,
<larangan khusus klip>,
English spoken dialogue,
English subtitles,
speech bubbles,
captions,
text overlays <kecuali ...>,
background music,
fade to black,
title card.
```
