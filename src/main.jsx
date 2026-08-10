import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserMultiFormatReader } from "@zxing/browser";
import {
  Camera,
  CameraOff,
  ImagePlus,
  ScanLine,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import "./style.css";

function App() {
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState("");
  const [format, setFormat] = useState("");
  const [message, setMessage] = useState("Arahkan kamera ke barcode.");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const stopScanner = () => {
    try {
      controlsRef.current?.stop();
      readerRef.current?.reset();
    } catch (_) {}
    controlsRef.current = null;
    setScanning(false);
  };

  const handleDecode = (res, err) => {
    if (res) {
      const text = res.getText();
      setResult(text);
      setFormat(res.getBarcodeFormat()?.toString?.() || "");
      setMessage("Barcode berhasil terbaca.");
      setError("");
      stopScanner();
    }

    if (err && err.name !== "NotFoundException") {
      // Most camera frames simply don't contain a barcode yet.
    }
  };

  const startScanner = async () => {
    setError("");
    setResult("");
    setFormat("");
    setMessage("Meminta akses kamera...");
    setScanning(true);

    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        handleDecode,
      );

      controlsRef.current = controls;
      setMessage("Kamera aktif — posisikan barcode di dalam kotak.");
    } catch (e) {
      setScanning(false);
      setError(
        "Kamera tidak bisa digunakan. Pastikan izin kamera diberikan dan gunakan HTTPS atau localhost.",
      );
      setMessage("Gagal membuka kamera.");
    }
  };

  const scanImage = async (file) => {
    if (!file) return;

    setError("");
    setResult("");
    setFormat("");
    setMessage("Menganalisis gambar...");

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = async () => {
      try {
        const reader = new BrowserMultiFormatReader();
        const res = await reader.decodeFromImageElement(img);

        setResult(res.getText());
        setFormat(res.getBarcodeFormat()?.toString?.() || "");
        setMessage("Barcode berhasil terbaca dari gambar.");
      } catch (_) {
        setError(
          "Barcode belum terbaca. Coba foto lebih dekat, lurus, terang, dan pastikan seluruh garis barcode terlihat.",
        );
        setMessage("Barcode tidak ditemukan.");
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("File gambar tidak dapat dibaca.");
      setMessage("Gagal membaca gambar.");
    };

    img.src = url;
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const reset = () => {
    stopScanner();
    setResult("");
    setFormat("");
    setError("");
    setMessage("Arahkan kamera ke barcode.");
  };

  useEffect(() => {
    return () => stopScanner();
  }, []);

  return (
    <main className="app">
      <section className="shell">
        <header className="header">
          <div className="logo">
            <ScanLine size={26} strokeWidth={2.4} />
          </div>
          <div>
            <h1>Barcode Scanner</h1>
            <p>Scan barcode dengan kamera atau foto</p>
          </div>
        </header>

        <section className="scanner-card">
          <div className="video-wrap">
            <video ref={videoRef} className="video" muted playsInline />
            {!scanning && (
              <div className="camera-placeholder">
                <ScanLine size={52} />
                <strong>Siap untuk scan</strong>
                <span>Tekan tombol kamera di bawah</span>
              </div>
            )}

            {scanning && (
              <div className="scan-overlay">
                <div className="scan-box">
                  <span className="corner tl" />
                  <span className="corner tr" />
                  <span className="corner bl" />
                  <span className="corner br" />
                  <div className="scan-line" />
                </div>
              </div>
            )}
          </div>

          <p className="status">{message}</p>

          <div className="actions">
            {!scanning ? (
              <button className="primary" onClick={startScanner}>
                <Camera size={20} />
                Buka Kamera
              </button>
            ) : (
              <button className="danger" onClick={stopScanner}>
                <CameraOff size={20} />
                Hentikan Kamera
              </button>
            )}

            <button
              className="secondary"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus size={20} />
              Upload Foto
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => scanImage(e.target.files?.[0])}
            />
          </div>
        </section>

        {error && (
          <div className="alert">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <section className="result-card">
          <div className="result-head">
            <div>
              <small>HASIL SCAN</small>
              <h2>{result || "Belum ada hasil"}</h2>
            </div>

            {result && (
              <button className="icon-btn" onClick={copyResult} title="Salin">
                {copied ? <Check size={20} /> : <Copy size={20} />}
              </button>
            )}
          </div>

          {format && (
            <div className="format">
              Format barcode: <strong>{format}</strong>
            </div>
          )}
        </section>

        <button className="reset" onClick={reset}>
          <RotateCcw size={17} />
          Reset
        </button>

        <footer>
          <span>Barcode</span>
          <span>•</span>
          <span>Scanner</span>
        </footer>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
