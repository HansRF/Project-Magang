# Barcode Scanner Web App

Web app React untuk membaca barcode menggunakan:

- Kamera HP/laptop
- Upload foto barcode
- ZXing (`@zxing/browser`)
- Responsive mobile

## Menjalankan

```bash
npm install
npm run dev
```

Buka URL Vite yang muncul, biasanya:

```text
http://localhost:5173
```

### Catatan kamera HP

Untuk akses kamera dari HP yang bukan `localhost`, browser biasanya membutuhkan **HTTPS**.

Setelah di-deploy ke Netlify/Vercel/GitHub Pages, kamera dapat digunakan melalui HTTPS.

## Cara scan

1. Tekan **Buka Kamera**.
2. Izinkan akses kamera.
3. Arahkan barcode ke kotak scan.
4. Hasil akan muncul otomatis.
5. Bisa juga tekan **Upload Foto** untuk scan dari gambar.
