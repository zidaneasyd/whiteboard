# Whiteboard Studio 1.0.0-rc.1

Whiteboard lokal berbasis HTML, CSS native, dan JavaScript tanpa Bootstrap atau dependensi runtime. Data board tersimpan per-board di IndexedDB dan hanya ditulis ketika pengguna menekan **Simpan / Ctrl+S**.

## Menjalankan

Buka `index.html` langsung untuk penggunaan lokal sederhana. Untuk origin lokal yang konsisten dan impor media yang lebih nyaman, jalankan:

```sh
node server.cjs
```

Lalu buka `http://127.0.0.1:4173/`. Pengujian logika dan pemeriksaan statis:

```sh
npm test
```

## Alur utama

- Halaman awal menampilkan maksimal tujuh board recent dan kartu tambah. Membuka halaman tidak membuat board otomatis.
- **New board** meminta nama; Enter memakai nama yang sedang terisi. Board baru tetap draft sampai disimpan.
- **Open all boards** membuka daftar tersimpan yang diurutkan menurut nama. Klik memilih pratinjau, klik dua kali membuka board.
- **Ctrl+S** menulis board aktif secara atomik ke IndexedDB dan menempatkannya di recent. Ekspor tidak mengubah status tersimpan.
- **Shift+W** menutup board aktif dan meminta pilihan simpan, buang, atau batal. Setelah tutup, board berikutnya dibuka; jika tidak ada, halaman recent tampil.
- **Shift+R** membuka halaman recent tanpa menghapus draft. Menutup tab browser saat draft masih ada memunculkan peringatan bawaan browser.

## Kartu dan media

Klik dua kali ruang kosong membuat kartu teks. Enter atau Ctrl+Space menyelesaikan editor; Shift+Enter membuat paragraf. Ctrl+A di editor memilih teks editor, sedangkan Ctrl+A di kanvas memilih kartu.

Kartu dapat dipilih, digeser, dipindah layer, di-group, di-copy, di-duplicate (offset kanan bawah tetap), di-paste mengikuti pointer, diberi warna, dan dihubungkan lewat tool Link atau Shift+L pada seleksi berurutan. Drag dengan Shift mengunci sumbu. Ghost drag berada di bawah kartu aktif dan bersifat inert.

Gambar, SVG, audio, video, dan dokumen teks dapat ditempel atau di-drop. Media hanya mempunyai tombol putar/jeda dan progres pasif; audio/video yang baru diputar menghentikan pemutar sebelumnya. Klik dua kali dokumen membuka viewer teks aman.

## Shortcut inti

| Aksi | Shortcut |
| --- | --- |
| Board baru / semua board | Ctrl+N / Ctrl+O |
| Open dari perangkat | Ctrl+Shift+O |
| Simpan / ekspor / impor | Ctrl+S / Ctrl+E / Ctrl+I |
| Tutup board / recent | Shift+W / Shift+R |
| Undo / redo / repeat | Ctrl+Z / Ctrl+Y / Ctrl+R |
| Select all / show all | Ctrl+A / Ctrl+Shift+A |
| Group / ungroup | Ctrl+G / Ctrl+U |
| Copy / cut / paste / duplicate | Ctrl+C / Ctrl+X / Ctrl+V / Ctrl+D |
| Hapus / zoom | Delete / Ctrl++ / Ctrl+- |
| Link seleksi / pindah tool | Shift+L / Space |

Shortcut browser yang dicadangkan seperti Ctrl+N dan Ctrl+W tidak diklaim dapat diblokir oleh halaman. Aplikasi memakai Shift+W untuk penutupan board agar tidak mengambil alih tab browser.

## Struktur

- `index.html` — markup dan dialog.
- `assets/css/app.css` — CSS native modern, responsif, grid kanvas, panel, dan media.
- `assets/js/core.js` — fungsi murni untuk batas zoom, urutan seleksi, link, duplikasi, layer, recent, dan bounds.
- `assets/js/storage.js` — IndexedDB v2 per-board, migrasi store lama, transaksi simpan/hapus.
- `assets/js/app.js` — rendering dan interaksi UI.
- `tests/` — pemeriksaan logika murni dan pemeriksaan struktur.

## Catatan rilis

Riwayat versi lengkap berada di tombol versi pada footer. Versi ini merapikan struktur file, menghapus ketergantungan framework, memperbaiki penyimpanan draft, memisahkan duplikasi dari paste, menjaga asset media tidak menggandakan payload pada undo/redo, mengoreksi pemulihan urutan group, dan menambah validasi viewer/import.
