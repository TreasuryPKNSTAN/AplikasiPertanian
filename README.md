!(Screenshot GUI AgriHub)[images/screenshot.jpg]
# AgriHub Pro

Aplikasi pertanian real-time untuk membantu petani dan pelaku agribisnis dengan Vite + React + Tailwind.
Pastikan punya node.js LTS sebelum memulai aplikasi

## Fitur
- Cuaca realtime (Open‑Meteo) + indikasi risiko hama (heuristik)
- Panduan budidaya ringkas
- Harga pasar (Mock/Live via API Anda)
- Koneksi pembeli (localStorage/Webhook)

## Cara Mulai Cepat
```bash
npm install
npm run dev
```

Buka `http://localhost:5173`.

## Build
```bash
npm run build
npm run preview
```

## Konfigurasi (opsional)
Buka tab **Pengaturan** di aplikasi untuk mengisi:
- `MARKET_API_URL` (+ `MARKET_API_KEY` jika ada)
- `WEBHOOK_URL` untuk meneruskan listing ke server/Google Sheet

## Git & Push ke GitHub
```bash
git init
git add .
git commit -m "feat: init AgriHub Pro"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

Jika sebelumnya muncul pesan "There is no tracking information for the current branch", jalankan dua baris terakhir (`branch -M` dan `push -u`) untuk set upstream tracking ke `origin/main`.

---
Dibuat dengan ❤️. Gunakan data dengan bijak. Heuristik risiko hama bersifat indikatif untuk edukasi.
