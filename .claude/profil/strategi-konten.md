# Strategi Konten @hikmamirz

Aturan kerja untuk rencana mingguan, brief harian, dan paket weekend. Data akun dan pembanding ada di `.claude/profil/hikmamirz.md`; baca keduanya.

## Posisi akun
Pertandingan nyata diceritakan sebagai **anime dramatis**. Itu pembeda dari @leonrdewa (komedi dialog) dan @plesbol_anime (format tren). Ciri yang dijaga di setiap video:
- Pola cerita: jatuh → bangkit, murid vs guru, penebusan.
- Pembuka caption pendek dan terpotong ("90+ minutes. Germany leads 1–0.").
- Evergreen dikemas sebagai seri bernama, supaya penonton mengenali episode berikutnya.

## Pilar
| Pilar | Isi | Porsi |
|---|---|---|
| Liverpool | Laga, pemain, dan tokoh Liverpool | Setiap kali Liverpool main |
| Laga besar | Klub raksasa Eropa dan timnas besar dengan pemain yang dikenal global | Slot reaktif lainnya |
| Evergreen | Legenda, comeback bersejarah, rivalitas, kisah pemain | Stok dari weekend |
| Eksperimen | Format baru, termasuk komedi dan parodi | 1 slot per minggu |

Evergreen dan eksperimen belum punya data di akun ini. Catat hasilnya di profil setelah diposting, lalu sesuaikan porsinya.

## Dua jalur
- **Reaktif**: cerita dari laga 1–2 hari terakhir. Dibuat di hari kerja, 1 video per hari, diposting hari itu juga.
- **Evergreen**: tidak basi. Dibuat borongan di weekend (3–4 video), dijadwalkan ke hari yang tidak punya cerita reaktif kuat.
- Target stok evergreen siap tayang: 5–7 video. Kalau stok di bawah 3, weekend berikutnya fokus mengisi stok.

## Memilih cerita reaktif
Pindai semua laga semalam (liga top Eropa, kompetisi Eropa, timnas), bukan hanya Liverpool. Urutan prioritas:
1. **Liverpool main**: otomatis kandidat utama.
2. **Laga besar**: klub raksasa atau timnas besar.
3. **Laga unik**: kejutan tim kecil, comeback, gol menit akhir, keputusan kontroversial, reuni pemain dengan mantan klub atau pelatihnya.

Nilai tiap kandidat dengan dua pertanyaan: ada pemain atau pelatih yang dikenal global? Ada busur emosional yang jelas? Laga unik tanpa nama besar tetap boleh menang kalau busurnya kuat.

Laga yang belum selesai saat brief ditulis tidak dipakai hari itu. Masukkan ke kandidat brief besok.

Kalau tidak ada kandidat reaktif yang kuat, pakai slot evergreen dari rencana mingguan.

## Ide dadakan
- Semua ide dadakan dicatat satu kalimat di kotak ide. Tidak langsung dieksekusi.
- Kotak ide dinilai saat rencana mingguan dan paket weekend disusun.
- Ide hanya boleh menyalip antrean kalau terkait laga dalam 48 jam terakhir. Ia menggantikan slot hari itu, tidak menambah.

## Ritme (WIB)
| Jadwal | Waktu | Perintah | Hasil |
|---|---|---|---|
| Rencana mingguan | Minggu 20.00 | `/rencana-mingguan` | Rencana 7 hari |
| Brief harian | Setiap hari 04.30 | `/brief-harian` | 1 brief siap eksekusi + 2 cadangan |
| Paket weekend | Jumat 16.00 | `/paket-weekend` | 3–4 brief evergreen |

Jadwal dipasang di mesin yang menyala 24 jam. Tiap jadwal diawali `git pull --ff-only` supaya memakai aturan terbaru.

## Penyimpanan
Semua hasil ada di `kantor/konten/` (di-gitignore, hanya ada di mesin yang menjalankan jadwal):
- `kotak-ide.md`: ide dadakan. Buat dari `.claude/templat/kotak-ide.md` kalau belum ada.
- `rencana/<YYYY-MM-DD>.md`: rencana mingguan, tanggal hari Senin.
- `brief/<YYYY-MM-DD>.md`: brief harian.
- `weekend/<YYYY-MM-DD>.md`: paket weekend, tanggal hari Sabtu.
- `riwayat.md`: satu baris per ide yang sudah dibuatkan brief (tanggal, pilar, judul kerja), supaya tidak diusulkan ulang.

Folder Google Drive konten: https://drive.google.com/drive/folders/1QFj27qJLIeMWckujD-vOe00SqgnfGvyq (Kantor Hikmamirz / Konten, disetujui pemilik akun 5 Oktober 2026)
- Kotak ide yang berlaku adalah dokumen "Kotak Ide" di folder itu, supaya bisa diisi dari HP. Baca dari sana, dan salin isinya ke `kantor/konten/kotak-ide.md` sebagai cadangan lokal.
- Setiap hasil disalin ke folder itu sebagai dokumen baru: "Brief <YYYY-MM-DD>", "Rencana <YYYY-MM-DD>", "Weekend <YYYY-MM-DD>".
- Google Docs menggabungkan baris yang hanya dipisah satu enter. Untuk salinan Drive, pisahkan baris kepala brief dan baris caption dengan baris kosong, dan jangan memakai tebal di dalam tabel.
- Izin menulis hanya berlaku untuk folder ini. Jangan mengubah, memindahkan, membagikan, atau menghapus file lain di Drive.
- Kalau Drive tidak bisa diakses, simpan lokal saja dan tulis kegagalannya di catatan hasil.

## Hemat kredit
Kredit vidIQ terbatas (habis saat riset 2 Oktober 2026). Brief harian memakai WebSearch untuk hasil laga dan tidak memanggil vidIQ. vidIQ hanya dipakai di rencana mingguan, untuk performa akun dan outlier.

## Batas
Jadwal berjalan tanpa pengguna, jadi tidak boleh bertanya dan tidak boleh melakukan tindakan keluar: tidak memposting, tidak menjadwalkan, tidak membuat draf Typefully, tidak push. Hasilnya hanya file.
