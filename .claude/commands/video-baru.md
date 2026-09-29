---
description: Alur video baru dari riset ide, paket skrip, sampai caption dan draf promosi
argument-hint: "[topik, pemain, atau pertandingan (opsional)]"
---

Jalankan alur **video baru** untuk kanal @hikmamirz.

Topik atau arahan dari pengguna: $ARGUMENTS
(Kalau kosong, biarkan `riset-konten` mencari topik terbaik sendiri berdasarkan pertandingan dan tren terbaru.)

Langkah-langkahnya berurutan, karena tiap langkah memakai hasil langkah sebelumnya:

1. **Riset** (agent `riset-konten`): cari 5 ide video lengkap dengan bukti datanya (link, angka plays, outlier), lalu tandai satu ide yang paling direkomendasikan beserta alasannya.
2. **Pilih ide**: tampilkan ringkasan 5 ide itu ke pengguna dan tanyakan mana yang dipakai. Kalau pengguna sudah memberi topik yang spesifik di atas, langsung pakai ide rekomendasi tanpa bertanya.
3. **Paket video** (agent `penulis-skrip`): dari ide terpilih, buat paket lengkap berisi 3 hook, skrip per adegan, 5 judul, deskripsi, dan konsep thumbnail.
4. **Promosi** (agent `sosmed-manager`): buat caption Instagram/TikTok dan teks promosi untuk platform lain. Tulis sebagai teks saja. Jangan buat draf Typefully sebelum pengguna setuju.

Setelah selesai:
- Simpan seluruh paket ke `kantor/video/<YYYY-MM-DD>-<slug-judul>.md` (folder `kantor/` di-gitignore).
- Rangkum hasilnya dalam Bahasa Indonesia: ide terpilih, hook terbaik, judul terbaik, dan caption.
- Tanyakan apakah pengguna mau membuat draf di Typefully. Jangan memublikasikan, menjadwalkan, atau mengunggah apa pun tanpa konfirmasi.
