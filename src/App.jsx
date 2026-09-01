import React, { useEffect, useRef, useState } from "react";

import { findTapeInCSV, normalizeCode, parseTapeFile } from "./utils/csv";

import {
  createScanner,
  getBarcodeFormat,
  getBarcodeText,
  scanImageFile,
} from "./utils/scanner";

import { Database, ScanLine, CheckCircle2, Search } from "lucide-react";

import Header from "./components/Header";
import CSVUpload from "./components/CSVupload";
import Scanner from "./components/Scanner";
import ErrorAlert from "./components/ErrorAlert";
import ResultCard from "./components/ResultCard";
import Footer from "./components/Footer";

const MAX_BARCODES = 5;

function App() {
  // =========================================================
  // REFS
  // =========================================================

  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const csvRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);

  // =========================================================
  // CAMERA STATE
  // =========================================================

  const [scanning, setScanning] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);

  // =========================================================
  // RESULT STATE
  // =========================================================

  const [results, setResults] = useState([]);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // =========================================================
  // STATUS
  // =========================================================

  const [message, setMessage] = useState(
    "Upload data CSV terlebih dahulu, lalu mulai scan.",
  );

  const [error, setError] = useState("");

  // =========================================================
  // CSV STATE
  // =========================================================

  const [csvData, setCsvData] = useState([]);
  const [csvLoaded, setCsvLoaded] = useState(false);
  const [csvFileName, setCsvFileName] = useState("");
  const [matchedCount, setMatchedCount] = useState(0);

  // =========================================================
  // STOP SCANNER
  // =========================================================

  const stopScanner = () => {
    try {
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
    } catch (err) {
      console.warn("Gagal stop controls:", err);
    }

    try {
      if (readerRef.current) {
        readerRef.current.reset();
      }
    } catch (err) {
      console.warn("Gagal reset reader:", err);
    }

    try {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject;

        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (err) {
            console.warn("Gagal menghentikan track:", err);
          }
        });

        videoRef.current.srcObject = null;
      }
    } catch (err) {
      console.warn("Gagal membersihkan video stream:", err);
    }

    controlsRef.current = null;
    readerRef.current = null;

    setScanning(false);
  };

  // =========================================================
  // HANDLE BARCODE
  // =========================================================

  const handleDecode = (res) => {
    if (!res) {
      return;
    }

    const text = getBarcodeText(res);

    if (!text) {
      return;
    }

    const format = getBarcodeFormat(res);
    const normalized = normalizeCode(text);

    setResults((previousResults) => {
      // Jangan masukkan barcode yang sama
      const alreadyExists = previousResults.some(
        (item) => normalizeCode(item.text) === normalized,
      );

      if (alreadyExists) {
        return previousResults;
      }

      // Maksimal 5
      if (previousResults.length >= MAX_BARCODES) {
        return previousResults;
      }

      // Cari di CSV / Excel
      const matchedTape = findTapeInCSV(csvData, text);

      const newItem = {
        text,
        format,
        found: Boolean(matchedTape),
        csvData: matchedTape,
        scannedAt: new Date().toLocaleTimeString("id-ID"),
      };

      const updatedResults = [...previousResults, newItem];

      // Status
      if (matchedTape) {
        setMessage(`✅ TAPE DISK DITEMUKAN — ${text}`);
        setError("");

        setMatchedCount((previous) => previous + 1);
      } else {
        setMessage(
          csvLoaded
            ? `❌ TAPE TIDAK ADA DI DATA — ${text}`
            : `Barcode terbaca — ${text}`,
        );
      }

      // Kalau sudah 5
      if (updatedResults.length >= MAX_BARCODES) {
        setTimeout(() => {
          stopScanner();

          setMessage(
            csvLoaded
              ? "5 tape selesai dipindai. Cek hasil di bawah."
              : "5 tape selesai dipindai.",
          );
        }, 500);
      }

      return updatedResults;
    });
  };

  // =========================================================
  // START CAMERA
  // =========================================================

  const startScanner = async () => {
    if (scanning) {
      return;
    }

    if (results.length >= MAX_BARCODES) {
      setMessage("5 tape sudah selesai dipindai. Tekan Scan Lagi.");
      return;
    }

    // Pastikan scanner sebelumnya benar-benar mati
    stopScanner();

    setError("");

    setMessage(
      csvLoaded
        ? "Meminta akses kamera..."
        : "Kamera aktif. Data CSV belum dimuat.",
    );

    setScanning(true);

    try {
      const reader = createScanner();

      readerRef.current = reader;

      if (!videoRef.current) {
        throw new Error("Video element tidak ditemukan.");
      }

      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
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

      setMessage(
        csvLoaded
          ? `Kamera aktif — arahkan ke tape. ${results.length}/${MAX_BARCODES} terbaca.`
          : `Kamera aktif — ${results.length}/${MAX_BARCODES} terbaca.`,
      );
    } catch (e) {
      console.error("Camera error:", e);

      try {
        if (videoRef.current?.srcObject) {
          videoRef.current.srcObject
            .getTracks()
            .forEach((track) => track.stop());

          videoRef.current.srcObject = null;
        }
      } catch (_) {}

      try {
        readerRef.current?.reset();
      } catch (_) {}

      controlsRef.current = null;
      readerRef.current = null;

      setScanning(false);

      setError(
        "Kamera tidak bisa digunakan. Pastikan izin kamera diberikan dan gunakan HTTPS atau localhost.",
      );

      setMessage("Gagal membuka kamera.");
    }
  };

  // =========================================================
  // UPLOAD CSV / XLSX / XLS
  // =========================================================

  const handleCSVUpload = async (file) => {
    if (!file) {
      return;
    }

    // Matikan kamera kalau sedang aktif
    if (scanning) {
      stopScanner();
    }

    setError("");

    const extension = file.name.split(".").pop().toLowerCase();

    const allowedExtensions = ["csv", "xlsx", "xls"];

    if (!allowedExtensions.includes(extension)) {
      setError("File harus berformat CSV, XLSX, atau XLS.");
      return;
    }

    setMessage("Sedang membaca data...");

    try {
      const parsedData = await parseTapeFile(file);

      if (!parsedData.length) {
        throw new Error("File tidak memiliki data tape.");
      }

      setCsvData(parsedData);
      setCsvLoaded(true);
      setCsvFileName(file.name);

      // Reset hasil scan karena data baru
      setResults([]);
      setMatchedCount(0);

      setMessage(`${parsedData.length} data tape berhasil dimuat.`);
      setError("");

      if (csvRef.current) {
        csvRef.current.value = "";
      }

      console.log(`DATA ${extension.toUpperCase()} BERHASIL DIMUAT`);
      console.table(parsedData);
    } catch (err) {
      console.error("File data error:", err);

      setCsvData([]);
      setCsvLoaded(false);
      setCsvFileName("");
      setMatchedCount(0);
      setResults([]);

      setError(
        `File ${extension.toUpperCase()} tidak dapat dibaca. Pastikan format dan isi file benar.`,
      );

      setMessage(`Gagal membaca ${extension.toUpperCase()}.`);
    }
  };

  // =========================================================
  // SCAN FOTO
  // =========================================================

  const scanImage = async (file) => {
    if (!file) {
      return;
    }

    // Matikan kamera sebelum scan foto
    stopScanner();

    setError("");
    setProcessingImage(true);
    setMessage("Menganalisis foto...");

    try {
      const res = await scanImageFile(file);

      if (!res) {
        throw new Error("Barcode tidak ditemukan.");
      }

      const text = getBarcodeText(res);

      if (!text) {
        throw new Error("Barcode tidak memiliki teks.");
      }

      const format = getBarcodeFormat(res);

      const matchedTape = findTapeInCSV(csvData, text);

      setResults((previousResults) => {
        // Cek duplikat
        const alreadyExists = previousResults.some(
          (item) => normalizeCode(item.text) === normalizeCode(text),
        );

        if (alreadyExists) {
          setMessage(`Barcode ${text} sudah ada di hasil scan.`);
          return previousResults;
        }

        // Maksimal 5
        if (previousResults.length >= MAX_BARCODES) {
          return previousResults;
        }

        const newItem = {
          text,
          format,
          found: Boolean(matchedTape),
          csvData: matchedTape,
          scannedAt: new Date().toLocaleTimeString("id-ID"),
        };

        const updated = [...previousResults, newItem];

        if (matchedTape) {
          setMatchedCount((previous) => previous + 1);

          setMessage(`✅ TAPE DISK DITEMUKAN — ${text}`);

          setError("");
        } else {
          setMessage(
            csvLoaded
              ? `❌ TAPE TIDAK ADA DI DATA — ${text}`
              : `Barcode terbaca — ${text}`,
          );
        }

        return updated;
      });
    } catch (err) {
      console.error("Image scan error:", err);

      setError(
        "Barcode belum terbaca dari foto. Coba gunakan foto yang lebih dekat, terang, dan tidak blur.",
      );

      setMessage("Barcode tidak ditemukan.");
    } finally {
      setProcessingImage(false);

      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  };

  // =========================================================
  // COPY RESULT
  // =========================================================

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
    } catch (_) {
      setError("Gagal menyalin hasil.");
    }
  };

  // =========================================================
  // DELETE RESULT
  // =========================================================

  const deleteResult = (index) => {
    const item = results[index];

    if (item?.found) {
      setMatchedCount((previous) => Math.max(0, previous - 1));
    }

    setResults((previous) => previous.filter((_, i) => i !== index));

    setMessage("Hasil scan dihapus.");
  };

  // =========================================================
  // RESET
  // =========================================================

  const reset = () => {
    stopScanner();

    setResults([]);
    setMatchedCount(0);
    setError("");

    setMessage(
      csvLoaded
        ? "Data masih aktif. Tekan Buka Kamera untuk scan lagi."
        : "Upload data CSV terlebih dahulu.",
    );
  };

  // =========================================================
  // CLEANUP
  // =========================================================

  useEffect(() => {
    return () => {
      try {
        controlsRef.current?.stop();
      } catch (_) {}

      try {
        readerRef.current?.reset();
      } catch (_) {}

      try {
        if (videoRef.current?.srcObject) {
          const stream = videoRef.current.srcObject;

          stream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch (_) {}
          });

          videoRef.current.srcObject = null;
        }
      } catch (_) {}

      controlsRef.current = null;
      readerRef.current = null;
    };
  }, []);

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <main className="app">
      <section className="shell">
        <Header />

        {/* =====================================================
            CSV / EXCEL UPLOAD
        ===================================================== */}

        <CSVUpload
          csvRef={csvRef}
          csvLoaded={csvLoaded}
          csvFileName={csvFileName}
          csvData={csvData}
          onUpload={handleCSVUpload}
        />

        {/* =====================================================
            SCANNER
        ===================================================== */}

        <Scanner
          videoRef={videoRef}
          fileRef={fileRef}
          scanning={scanning}
          processingImage={processingImage}
          resultsLength={results.length}
          maxBarcodes={MAX_BARCODES}
          csvLoaded={csvLoaded}
          message={message}
          onStartScanner={startScanner}
          onStopScanner={stopScanner}
          onScanImage={scanImage}
        />

        {/* =====================================================
            ERROR
        ===================================================== */}

        <ErrorAlert error={error} />

        {/* =====================================================
            SEARCH SUMMARY
            DIBUAT LANGSUNG DI APP
            TIDAK LAGI MEMAKAI SearchSummary.jsx
        ===================================================== */}

        {csvLoaded && (
          <section className="search-summary">
            <div className="summary-item">
              <Database size={20} />

              <div>
                <small>DATA TAPE</small>
                <strong>{csvData.length}</strong>
              </div>
            </div>

            <div className="summary-item">
              <CheckCircle2 size={20} />

              <div>
                <small>DITEMUKAN</small>
                <strong>{matchedCount}</strong>
              </div>
            </div>

            <div className="summary-item">
              <Search size={20} />

              <div>
                <small>DI-SCAN</small>
                <strong>{results.length}</strong>
              </div>
            </div>
          </section>
        )}

        {/* =====================================================
            HASIL SCAN
        ===================================================== */}

        <ResultCard
          results={results}
          copiedIndex={copiedIndex}
          csvLoaded={csvLoaded}
          onCopy={copyResult}
          onDelete={deleteResult}
        />

        {/* =====================================================
            RESET
        ===================================================== */}

        <button className="reset" onClick={reset}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            ↻
          </span>

          {results.length >= MAX_BARCODES ? "Scan Lagi" : "Reset Hasil"}
        </button>

        <Footer />
      </section>
    </main>
  );
}

export default App;
