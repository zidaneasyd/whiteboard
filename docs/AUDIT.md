# Audit rilis 1.0.0-rc.1

Audit ini merangkum keputusan terakhir dari sesi pengembangan. Ketika dua permintaan bertabrakan, perilaku yang disebut paling baru dipakai.

## Koreksi alur

| Area | Masalah yang ditemukan | Koreksi |
| --- | --- | --- |
| Pembukaan | Board otomatis dibuat atau langsung aktif saat halaman dibuka | Halaman awal hanya memuat daftar Recent; board aktif baru ada setelah dibuka atau dibuat |
| Simpan | Satu snapshot global dapat membawa draft board lain dan status berhasil ditandai sebelum transaksi selesai | IndexedDB v2 menyimpan record board aktif secara atomik; UI baru menandai tersimpan setelah transaksi selesai |
| Draft | Pindah board dapat membawa data yang belum disimpan | Pindah, tutup, dan buat board baru memberi pilihan simpan atau buang; beforeunload hanya aktif ketika dirty |
| Recent | Recent berubah ketika edit biasa | Recent diperbarui ketika Save atau duplikasi board tersimpan selesai |
| Undo/redo | Kamera zoom/pan ikut tercatat dan payload media berulang | Snapshot hanya cards/connections; bytes media disimpan dalam cache asset sesi, kamera tidak masuk history |
| Group | Ungroup dapat mengurutkan kartu lain ke posisi keliru | Urutan penuh sebelum group disimpan dan dipulihkan per anggota group |
| Duplikat | Duplikat dan paste dapat memakai offset yang sama | Duplicate selalu offset kanan bawah 24px; Paste memakai titik pointer |
| Import | File async dapat masuk ke board yang sudah berganti | Board tujuan ditangkap sebelum proses async dan diverifikasi kembali |
| Rich text | Markup asing dan elemen interaktif dapat lolos | Sanitizer memakai whitelist elemen dan hanya menyimpan `text-align` |
| Media | Audio/video native dibuat dua kali dan kontrol native dapat menggeser kartu | Player pasif dibuat satu kali; hanya tombol play/pause yang aktif, pemutar lain berhenti |
| Garis | Posisi garis dapat kabur pada pan/zoom | Koordinat dirasterkan ke piksel perangkat dan SVG memakai geometric precision |
| Ghost | Ghost berada di atas atau hilang di belakang world | Ghost inert, transparan, dan berada pada z-index di bawah kartu aktif |

## Cakupan fungsional

Kartu teks, rich text, gambar/SVG, audio, video, dan dokumen teks; drag, snap, axis lock, marquee, seleksi Shift, layer, group/ungroup, link tool, Shift+L, label garis, palette, color history, paste teks/gambar, JSON import/export, PDF print sheet, thumbnail board, recent/all board, dan tampilan mobile tetap tersedia.

## Batas browser

Halaman tidak mengklaim dapat memblokir shortcut browser yang dicadangkan seperti Ctrl+N atau Ctrl+W. Penutupan board memakai Shift+W. Ctrl+S, Ctrl+O, Ctrl+E, Ctrl+I, dan Ctrl+R ditangani ketika kanvas aktif; browser dapat tetap mengutamakan shortcut sistem pada konteks tertentu.

## Verifikasi

- `npm test` menjalankan uji fungsi inti untuk batas zoom, nama board, urutan link, duplikasi offset, bounds, dan recent, lalu pemeriksaan struktur tanpa Bootstrap.
- `node --check` lulus untuk `core.js`, `storage.js`, dan `app.js`.
- Uji visual browser otomatis tidak dijalankan karena binary Chromium tidak tersedia di runtime ini; jalankan `node server.cjs` lalu lakukan smoke test manual pada Chrome/Edge terbaru.

## Smoke test rilis

1. Buka halaman awal dan pastikan tidak ada board otomatis.
2. Buat board, buat kartu, edit dengan Ctrl+A, Enter, dan Shift+Enter.
3. Tutup dengan Shift+W; pilih Simpan & tutup, lalu buka kembali dari Recent.
4. Uji duplicate, paste, undo/redo, group/ungroup, Shift+L, label garis, zoom 10–400%, dan show all.
5. Drop gambar/audio/video/dokumen, putar satu media, lalu putar media kedua.
6. Ekspor JSON/PDF, impor JSON ke board baru, dan pastikan draft tidak masuk database sebelum Ctrl+S.
