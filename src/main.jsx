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
  Trash2,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";
import "./style.css";

function App() {
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);

  const MAX_BARCODES = 5;

  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState("Arahkan kamera ke barcode.");
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [processingImage, setProcessingImage] = useState(false);

  // =====================================================
  // STOP CAMERA
  // =====================================================

  const stopScanner = () => {
    try {
      controlsRef.current?.stop();
      readerRef.current?.reset();
    } catch (_) {}

    controlsRef.current = null;
    readerRef.current = null;

    setScanning(false);
  };

  // =====================================================
  // ADD BARCODE
  // =====================================================

  const addBarcode = (text, format = "UNKNOWN") => {
    if (!text) {
      return false;
    }

    let added = false;

    setResults((previousResults) => {
      // Jangan masukkan barcode yang sama
      const exists = previousResults.some((item) => item.text === text);

      if (exists) {
        return previousResults;
      }

      // Maksimal 5
      if (previousResults.length >= MAX_BARCODES) {
        return previousResults;
      }

      added = true;

      return [
        ...previousResults,
        {
          text,
          format,
        },
      ];
    });

    return added;
  };

  // =====================================================
  // HANDLE CAMERA DECODE
  // =====================================================

  const handleDecode = (res, err) => {
    if (!res) {
      return;
    }

    const text = res.getText();

    if (!text) {
      return;
    }

    setResults((previousResults) => {
      const alreadyExists = previousResults.some((item) => item.text === text);

      if (alreadyExists) {
        return previousResults;
      }

      if (previousResults.length >= MAX_BARCODES) {
        return previousResults;
      }

      const updatedResults = [
        ...previousResults,
        {
          text,
          format: res.getBarcodeFormat()?.toString?.() || "UNKNOWN",
        },
      ];

      const total = updatedResults.length;

      if (total >= MAX_BARCODES) {
        setMessage("✓ 5 barcode berhasil terbaca. Kamera dihentikan.");

        setTimeout(() => {
          stopScanner();
        }, 200);
      } else {
        setMessage(`Barcode ${total}/${MAX_BARCODES} berhasil terbaca.`);
      }

      return updatedResults;
    });

    setError("");
  };

  // =====================================================
  // START CAMERA
  // =====================================================

  const startScanner = async () => {
    stopScanner();

    setError("");
    setResults([]);
    setProcessingImage(false);
    setMessage("Meminta akses kamera...");
    setScanning(true);

    try {
      const reader = new BrowserMultiFormatReader();

      readerRef.current = reader;

      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: {
              ideal: "environment",
            },
            width: {
              ideal: 1920,
            },
            height: {
              ideal: 1080,
            },
          },
        },
        videoRef.current,
        handleDecode,
      );

      controlsRef.current = controls;

      setMessage("Kamera aktif — arahkan ke barcode.");
    } catch (e) {
      console.error("Camera error:", e);

      setScanning(false);

      setError(
        "Kamera tidak bisa digunakan. Pastikan izin kamera diberikan dan gunakan HTTPS atau localhost.",
      );

      setMessage("Gagal membuka kamera.");
    }
  };

  // =====================================================
  // DECODE SINGLE REGION
  // =====================================================

  const decodeCanvas = async (canvas) => {
    try {
      const reader = new BrowserMultiFormatReader();

      const result = await reader.decodeFromCanvas(canvas);

      if (!result) {
        return null;
      }

      return {
        text: result.getText(),
        format: result.getBarcodeFormat()?.toString?.() || "UNKNOWN",
      };
    } catch (_) {
      return null;
    }
  };

  // =====================================================
  // SCAN FOTO DENGAN MULTI REGION
  // =====================================================

  const scanImage = async (file) => {
    if (!file) {
      return;
    }

    stopScanner();

    setError("");
    setResults([]);
    setProcessingImage(true);
    setMessage("Menganalisis foto dan mencari 5 barcode...");

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = async () => {
      try {
        // =================================================
        // CANVAS UTAMA
        // =================================================

        const originalWidth = img.naturalWidth;
        const originalHeight = img.naturalHeight;

        if (!originalWidth || !originalHeight) {
          throw new Error("Ukuran gambar tidak valid.");
        }

        /*
         * Kita batasi ukuran gambar supaya proses
         * tidak terlalu berat di HP.
         */

        const MAX_WIDTH = 1800;

        let width = originalWidth;
        let height = originalHeight;

        if (width > MAX_WIDTH) {
          const ratio = MAX_WIDTH / width;

          width = MAX_WIDTH;
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d", {
          willReadFrequently: true,
        });

        ctx.drawImage(img, 0, 0, width, height);

        // =================================================
        // REGION YANG AKAN DI-SCAN
        // =================================================

        /*
         * Kita tidak hanya scan 1 gambar.
         *
         * Gambar dibagi menjadi beberapa region:
         *
         * ┌─────────┬─────────┐
         * │    1    │    2    │
         * ├─────────┼─────────┤
         * │    3    │    4    │
         * ├─────────┼─────────┤
         * │    5    │    6    │
         * └─────────┴─────────┘
         *
         * Ditambah scan full image.
         *
         * Region dibuat overlap agar barcode
         * yang berada di batas tidak terpotong.
         */

        const regions = [];

        // -------------------------------------------------
        // FULL IMAGE
        // -------------------------------------------------

        regions.push({
          x: 0,
          y: 0,
          width,
          height,
          name: "full",
        });

        // -------------------------------------------------
        // 2 KOLOM
        // -------------------------------------------------

        const overlapX = 0.12;

        const halfWidth = width / 2;

        regions.push({
          x: 0,
          y: 0,
          width: Math.min(width, halfWidth * (1 + overlapX)),
          height,
          name: "left",
        });

        regions.push({
          x: Math.max(0, halfWidth * (1 - overlapX)),
          y: 0,
          width: Math.min(width, halfWidth * (1 + overlapX)),
          height,
          name: "right",
        });

        // -------------------------------------------------
        // 3 BARIS
        // -------------------------------------------------

        const overlapY = 0.15;

        const thirdHeight = height / 3;

        for (let i = 0; i < 3; i++) {
          const startY = Math.max(0, i * thirdHeight - thirdHeight * overlapY);

          const endY = Math.min(
            height,
            (i + 1) * thirdHeight + thirdHeight * overlapY,
          );

          regions.push({
            x: 0,
            y: startY,
            width,
            height: endY - startY,
            name: `row-${i + 1}`,
          });
        }

        // -------------------------------------------------
        // 2 x 3 GRID
        // -------------------------------------------------

        const cellWidth = width / 2;
        const cellHeight = height / 3;

        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 2; col++) {
            const x = Math.max(0, col * cellWidth - cellWidth * 0.12);

            const y = Math.max(0, row * cellHeight - cellHeight * 0.15);

            const right = Math.min(
              width,
              (col + 1) * cellWidth + cellWidth * 0.12,
            );

            const bottom = Math.min(
              height,
              (row + 1) * cellHeight + cellHeight * 0.15,
            );

            regions.push({
              x,
              y,
              width: right - x,
              height: bottom - y,
              name: `grid-${row}-${col}`,
            });
          }
        }

        // =================================================
        // SCAN SEMUA REGION
        // =================================================

        const found = [];

        for (let i = 0; i < regions.length; i++) {
          // Kalau sudah dapat 5,
          // hentikan proses.
          if (found.length >= MAX_BARCODES) {
            break;
          }

          const region = regions[i];

          setMessage(`Mencari barcode... ${i + 1}/${regions.length}`);

          // ---------------------------------------------
          // CANVAS REGION
          // ---------------------------------------------

          const regionCanvas = document.createElement("canvas");

          regionCanvas.width = Math.round(region.width);

          regionCanvas.height = Math.round(region.height);

          const regionCtx = regionCanvas.getContext("2d", {
            willReadFrequently: true,
          });

          regionCtx.drawImage(
            canvas,
            region.x,
            region.y,
            region.width,
            region.height,
            0,
            0,
            region.width,
            region.height,
          );

          // ---------------------------------------------
          // COBA SCAN REGION NORMAL
          // ---------------------------------------------

          const result = await decodeCanvas(regionCanvas);

          if (result?.text) {
            const exists = found.some((item) => item.text === result.text);

            if (!exists) {
              found.push(result);

              setResults([...found]);
            }
          }
        }

        // =================================================
        // HASIL
        // =================================================

        if (found.length === 0) {
          setError(
            "Tidak ada barcode yang terbaca. Pastikan barcode terlihat jelas, tidak blur, dan pencahayaan cukup.",
          );

          setMessage("Barcode tidak ditemukan.");
        } else if (found.length < MAX_BARCODES) {
          setMessage(`${found.length} barcode berhasil terbaca.`);

          setError(
            `Baru ${found.length} dari ${MAX_BARCODES} barcode yang terbaca. Coba foto lebih dekat atau pastikan semua barcode terlihat jelas.`,
          );
        } else {
          setMessage("✓ 5 barcode berhasil ditemukan!");

          setError("");
        }
      } catch (e) {
        console.error("Multi barcode scan error:", e);

        setError("Terjadi kesalahan saat menganalisis gambar.");

        setMessage("Gagal menganalisis gambar.");
      } finally {
        URL.revokeObjectURL(url);

        setProcessingImage(false);

        if (fileRef.current) {
          fileRef.current.value = "";
        }
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);

      setProcessingImage(false);

      setError("File gambar tidak dapat dibaca.");

      setMessage("Gagal membaca gambar.");

      if (fileRef.current) {
        fileRef.current.value = "";
      }
    };

    img.src = url;
  };

  // =====================================================
  // COPY
  // =====================================================

  const copyResult = async (text, index) => {
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);

      setCopiedIndex(index);

      setTimeout(() => {
        setCopiedIndex(null);
      }, 1500);
    } catch (e) {
      console.error("Copy error:", e);

      setError("Barcode tidak dapat disalin.");
    }
  };

  // =====================================================
  // DELETE
  // =====================================================

  const deleteResult = (index) => {
    setResults((previousResults) =>
      previousResults.filter((_, currentIndex) => currentIndex !== index),
    );

    setMessage("Barcode dihapus. Kamu bisa scan lagi.");

    setError("");
  };

  // =====================================================
  // RESET
  // =====================================================

  const reset = () => {
    stopScanner();

    setResults([]);
    setError("");
    setCopiedIndex(null);
    setProcessingImage(false);

    setMessage("Arahkan kamera ke barcode.");
  };

  // =====================================================
  // CLEANUP
  // =====================================================

  useEffect(() => {
    return () => {
      try {
        controlsRef.current?.stop();
        readerRef.current?.reset();
      } catch (_) {}
    };
  }, []);

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <main className="app">
      <section className="shell">
        {/* HEADER */}

        <header className="header">
          <div className="logo">
            <ScanLine size={26} strokeWidth={2.4} />
          </div>

          <div>
            <h1>Barcode Scanner</h1>

            <p>Scan hingga 5 barcode</p>
          </div>
        </header>

        {/* SCANNER */}

        <section className="scanner-card">
          <div className="video-wrap">
            <video ref={videoRef} className="video" muted playsInline />

            {!scanning && !processingImage && (
              <div className="camera-placeholder">
                <ScanLine size={52} />

                <strong>Siap untuk scan</strong>

                <span>Gunakan kamera atau upload foto</span>
              </div>
            )}

            {processingImage && (
              <div className="camera-placeholder">
                <LoaderCircle size={48} className="loading-icon" />

                <strong>Menganalisis foto...</strong>

                <span>Sedang mencari semua barcode</span>
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

                <div className="scan-progress">
                  <strong>
                    {results.length}
                    <span>/{MAX_BARCODES}</span>
                  </strong>

                  <small>barcode terbaca</small>
                </div>
              </div>
            )}
          </div>

          {/* STATUS */}

          <p className="status">{message}</p>

          {/* BUTTON */}

          <div className="actions">
            {!scanning ? (
              <button
                className="primary"
                onClick={startScanner}
                disabled={processingImage}
              >
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
              disabled={processingImage}
            >
              {processingImage ? (
                <LoaderCircle size={20} className="loading-icon" />
              ) : (
                <ImagePlus size={20} />
              )}

              {processingImage ? "Memproses..." : "Upload Foto"}
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => scanImage(event.target.files?.[0])}
            />
          </div>
        </section>

        {/* ERROR */}

        {error && (
          <div className="alert">
            <AlertCircle size={20} />

            <span>{error}</span>
          </div>
        )}

        {/* RESULT */}

        <section className="result-card">
          <div className="result-head">
            <div>
              <small>HASIL SCAN</small>

              <h2>
                {results.length}/{MAX_BARCODES}
              </h2>
            </div>

            {results.length === MAX_BARCODES && (
              <CheckCircle2 size={26} color="#4ade80" />
            )}
          </div>

          {/* EMPTY */}

          {results.length === 0 && (
            <div className="empty-result">
              <ScanLine size={30} />

              <span>Belum ada barcode yang terbaca</span>
            </div>
          )}

          {/* RESULTS */}

          {results.length > 0 && (
            <div className="result-list">
              {results.map((item, index) => (
                <div className="barcode-item" key={`${item.text}-${index}`}>
                  <div className="barcode-number">{index + 1}</div>

                  <div className="barcode-content">
                    <div className="barcode-text">{item.text}</div>

                    <div className="barcode-format">{item.format}</div>
                  </div>

                  <div className="barcode-actions">
                    <button
                      className="small-btn"
                      onClick={() => copyResult(item.text, index)}
                      title="Salin barcode"
                    >
                      {copiedIndex === index ? (
                        <Check size={17} />
                      ) : (
                        <Copy size={17} />
                      )}
                    </button>

                    <button
                      className="small-btn delete"
                      onClick={() => deleteResult(index)}
                      title="Hapus barcode"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SUCCESS */}

          {results.length === MAX_BARCODES && (
            <div className="result-success">
              <CheckCircle2 size={18} />

              <span>5 barcode berhasil terbaca.</span>
            </div>
          )}
        </section>

        {/* RESET */}

        <button className="reset" onClick={reset}>
          <RotateCcw size={17} />
          Scan Ulang
        </button>

        {/* FOOTER */}

        <footer>
          <span>Barcode</span>
          <span>•</span>
          <span>Scanner</span>
        </footer>
      </section>
    </main>
  );
}

// =====================================================
// RENDER
// =====================================================

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
