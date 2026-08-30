import React, { useEffect, useRef, useState } from "react";

import { findTapeInCSV, normalizeCode, parseTapeCSV } from "./utils/csv";

import {
  createScanner,
  getBarcodeFormat,
  getBarcodeText,
  scanImageFile,
} from "./utils/scanner";

import Header from "./components/Header";
import CSVUpload from "./components/CSVUpload";
import Scanner from "./components/Scanner";
import ErrorAlert from "./components/ErrorAlert";
import SearchSummary from "./components/SearchSummary";
import ResultCard from "./components/ResultCard";
import Footer from "./components/Footer";

const MAX_BARCODES = 5;

function App() {
  // REFS
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const csvRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);

  // CAMERA STATE
  const [scanning, setScanning] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);

  // RESULT STATE
  const [results, setResults] = useState([]);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // STATUS
  const [message, setMessage] = useState(
    "Upload data CSV terlebih dahulu, lalu mulai scan.",
  );

  const [error, setError] = useState("");

  // CSV STATE
  const [csvData, setCsvData] = useState([]);
  const [csvLoaded, setCsvLoaded] = useState(false);
  const [csvFileName, setCsvFileName] = useState("");
  const [matchedCount, setMatchedCount] = useState(0);

  // STOP CAMERA
  const stopScanner = () => {
    try {
      controlsRef.current?.stop();
    } catch (_) {}

    try {
      readerRef.current?.reset();
    } catch (_) {}

    controlsRef.current = null;
    readerRef.current = null;

    setScanning(false);
  };

  // HANDLE BARCODE
  const handleDecode = (res, err) => {
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
      const alreadyExists = previousResults.some(
        (item) => normalizeCode(item.text) === normalized,
      );

      if (alreadyExists) {
        return previousResults;
      }

      if (previousResults.length >= MAX_BARCODES) {
        return previousResults;
      }

      const matchedTape = findTapeInCSV(csvData, text);

      const newItem = {
        text: text,
        format: format,
        found: Boolean(matchedTape),
        csvData: matchedTape,
        scannedAt: new Date().toLocaleTimeString("id-ID"),
      };

      const updatedResults = [...previousResults, newItem];

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

  // START CAMERA
  const startScanner = async () => {
    if (scanning) return;

    if (results.length >= MAX_BARCODES) {
      setMessage("5 tape sudah selesai dipindai. Tekan Scan Lagi.");

      return;
    }

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

      setScanning(false);

      setError(
        "Kamera tidak bisa digunakan. Pastikan izin kamera diberikan dan gunakan HTTPS atau localhost.",
      );

      setMessage("Gagal membuka kamera.");
    }
  };

  // UPLOAD CSV
  const handleCSVUpload = (file) => {
    if (!file) return;

    setError("");

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("File harus berformat CSV.");

      return;
    }

    setMessage("Sedang membaca data CSV...");

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result;

        if (!text) {
          throw new Error("CSV kosong.");
        }

        const parsedData = parseTapeCSV(text);

        setCsvData(parsedData);
        setCsvLoaded(true);
        setCsvFileName(file.name);
        setMatchedCount(0);

        setResults([]);

        setMessage(`${parsedData.length} data tape berhasil dimuat.`);

        setError("");

        if (csvRef.current) {
          csvRef.current.value = "";
        }

        console.log("DATA CSV BERHASIL DIMUAT:");

        console.table(parsedData);
      } catch (err) {
        console.error("CSV error:", err);

        setCsvData([]);
        setCsvLoaded(false);
        setCsvFileName("");
        setMatchedCount(0);

        setError("CSV tidak dapat dibaca. Pastikan format CSV benar.");

        setMessage("Gagal membaca CSV.");
      }
    };

    reader.onerror = () => {
      setError("File CSV tidak dapat dibaca.");

      setMessage("Gagal membaca CSV.");
    };

    reader.readAsText(file);
  };

  // SCAN FOTO
  const scanImage = async (file) => {
    if (!file) return;

    setError("");
    setProcessingImage(true);

    setMessage("Menganalisis foto...");

    try {
      const res = await scanImageFile(file);

      const text = getBarcodeText(res);

      const format = getBarcodeFormat(res);

      const matchedTape = findTapeInCSV(csvData, text);

      setResults((previousResults) => {
        const alreadyExists = previousResults.some(
          (item) => normalizeCode(item.text) === normalizeCode(text),
        );

        if (alreadyExists) {
          return previousResults;
        }

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
    }

    if (fileRef.current) {
      fileRef.current.value = "";
    }
  };

  // COPY
  const copyResult = async (text, index) => {
    if (!text) return;

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

  // DELETE RESULT
  const deleteResult = (index) => {
    const item = results[index];

    if (item?.found) {
      setMatchedCount((previous) => Math.max(0, previous - 1));
    }

    setResults((previous) => previous.filter((_, i) => i !== index));

    setMessage("Hasil scan dihapus.");
  };

  // RESET SESSION
  const reset = () => {
    stopScanner();

    setResults([]);
    setMatchedCount(0);
    setError("");

    setMessage(
      csvLoaded
        ? "Data CSV masih aktif. Tekan Buka Kamera untuk scan lagi."
        : "Upload data CSV terlebih dahulu.",
    );
  };

  // CLEANUP
  useEffect(() => {
    return () => {
      try {
        controlsRef.current?.stop();
      } catch (_) {}

      try {
        readerRef.current?.reset();
      } catch (_) {}
    };
  }, []);

  // RENDER
  return (
    <main className="app">
      <section className="shell">
        <Header />

        <CSVUpload
          csvRef={csvRef}
          csvLoaded={csvLoaded}
          csvFileName={csvFileName}
          csvData={csvData}
          onUpload={handleCSVUpload}
        />

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

        <ErrorAlert error={error} />

        {csvLoaded && (
          <SearchSummary
            csvDataLength={csvData.length}
            matchedCount={matchedCount}
            resultsLength={results.length}
          />
        )}

        <ResultCard
          results={results}
          copiedIndex={copiedIndex}
          csvLoaded={csvLoaded}
          onCopy={copyResult}
          onDelete={deleteResult}
        />

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
