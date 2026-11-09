# DRIP CLIENT STORE

Starter toko digital dengan katalog Drip API, halaman admin, penyimpanan API Key terenkripsi, dan area QR pembayaran.

## Penting sebelum dipakai

- GitHub menyimpan source code; **jangan deploy hanya sebagai GitHub Pages**. Login admin dan API Key membutuhkan backend.
- Deploy repository ini sebagai **Render Web Service**. File `render.yaml` membantu membuat service.
- Render perlu persistent disk untuk menyimpan database `data/store.db`.
- Jangan commit `.env`, API Key, password, atau database ke GitHub.
- Katalog publik tanpa API Key menampilkan harga retail. Dengan API Key, backend mengambil harga tier akun kamu.
- API Drip memotong saldo wallet ketika order dibuat. Versi starter ini sengaja **belum mengaktifkan endpoint pembelian** sampai payment gateway/konfirmasi pembayaran terverifikasi dipasang. Jangan menerima pembayaran otomatis tanpa verifikasi.

## Upload ke GitHub

1. Buat repository baru, misalnya `drip-client-store`.
2. Extract ZIP ini.
3. Upload semua file dan folder ke root repository.
4. Pastikan `.env` dan `data/` tidak ikut diupload.

## Deploy ke Render

1. Buat akun di https://render.com dan hubungkan GitHub.
2. Pilih **New → Blueprint** lalu pilih repository.
3. Render membaca `render.yaml`. Jika diminta, buat service.
4. Pastikan persistent disk aktif pada `/opt/render/project/src/data`.
5. Di Environment, isi `ADMIN_PASSWORD` dengan password baru yang kuat. `ADMIN_USERNAME` sudah `riski`.
6. Pastikan `SESSION_SECRET` dan `ENCRYPTION_KEY` terisi. `ENCRYPTION_KEY` harus tepat 64 karakter hex (32 bytes). Buat dengan `openssl rand -hex 32`. Simpan cadangannya; mengganti key membuat API Key tersimpan tidak bisa didekripsi.
7. Deploy dan buka URL Render.

## Mengatur toko

1. Klik **Admin** di kanan atas.
2. Login dengan username `riski` dan password dari environment `ADMIN_PASSWORD`.
3. Masukkan Drip API Key (`drip_sk_test_...` untuk uji coba atau live key saat siap).
4. Simpan. Key dienkripsi di server menggunakan AES-256-GCM.
5. Masukkan URL gambar QRIS dan instruksi pembayaran di dashboard admin.

## Pembayaran dan transaksi

QR di versi ini hanya menampilkan informasi pembayaran; belum memverifikasi uang masuk dan belum membuat order Drip. Sebelum membuka penjualan otomatis, integrasikan payment gateway/webhook yang memverifikasi status pembayaran di server, lalu baru panggil `POST /api/v1/orders` menggunakan SKU `items[].apiCode` dan header `Idempotency-Key`. Jangan percaya screenshot/unggahan bukti transfer sebagai konfirmasi otomatis.

## API Drip yang digunakan

- `GET /api/v1/products` katalog + harga tier
- `GET /api/v1/me` profil akun
- `GET /api/v1/balance` saldo wallet

Dokumentasi: https://www.dripclientofficial.dev/developers
