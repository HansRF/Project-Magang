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
  FileSpreadsheet,
  Search,
  XCircle,
  Database,
} from "lucide-react";

import "./style.css";
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

  // NORMALIZE CODE
  const normalizeCode = (value) => {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = "";
    let insideQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
        continue;
      }

      if (char === "," && !insideQuotes) {
        result.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }

    result.push(current.trim());
    return result.map((value) => value.replace(/^"|"$/g, "").trim());
  };

  // FIND TAPE IN CSV
  const findTapeInCSV = (scannedCode) => {
    const normalizedScanned = normalizeCode(scannedCode);

    if (!normalizedScanned || csvData.length === 0) {
      return null;
    }

    return (
      csvData.find((item) => {
        return normalizeCode(item.code) === normalizedScanned;
      }) || null
    );
  };

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

  // START CAMERA
  const startScanner = async () => {
    // Jangan mulai kalau sudah scan
    if (scanning) return;

    // Maksimal 5 hasil
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
      const reader = new BrowserMultiFormatReader();
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

  // HANDLE BARCODE
  const handleDecode = (res, err) => {
    if (!res) {
      return;
    }
    const text = res.getText()?.trim();
    if (!text) {
      return;
    }
    const format = res.getBarcodeFormat()?.toString?.() || "UNKNOWN";
    const normalized = normalizeCode(text);

    // CEK DUPLIKAT
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

      // CARI DI CSV
      const matchedTape = findTapeInCSV(text);
      const newItem = {
        text: text,
        format: format,
        found: Boolean(matchedTape),

        csvData: matchedTape,
        scannedAt: new Date().toLocaleTimeString("id-ID"),
      };
      const updatedResults = [...previousResults, newItem];

      // STATUS
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

      // SUDAH 5
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

        // Pecah CSV berdasarkan baris
        const lines = text
          .replace(/^\uFEFF/, "") // hapus BOM jika ada
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        if (lines.length === 0) {
          throw new Error("CSV tidak mempunyai data.");
        }

        
        // CEK APAKAH BARIS PERTAMA ADALAH HEADER
        const firstRow = parseCSVLine(lines[0]);
        const firstValue = normalizeCode(firstRow[0]);
        const possibleHeaders = [
          "KODE",
          "CODE",
          "BARCODE",
          "SERIAL",
          "SERIALNUMBER",
          "TAPE",
          "TAPEID",
          "TAPECODE",
          "ID",
        ];
        const isHeader =
          possibleHeaders.includes(firstValue) ||
          firstValue.includes("KODE") ||
          firstValue.includes("CODE") ||
          firstValue.includes("BARCODE") ||
          firstValue.includes("SERIAL") ||
          firstValue.includes("TAPE");

        
        // TENTUKAN MULAI DATA
        let startIndex = 0;
        let headers = ["kode"];
        let codeIndex = 0;

        // Kalau CSV punya header
        if (isHeader) {
          headers = firstRow.map((header) => header.toLowerCase().trim());
          codeIndex = headers.findIndex(
            (header) =>
              header.includes("kode") ||
              header.includes("code") ||
              header.includes("barcode") ||
              header.includes("serial") ||
              header.includes("tape") ||
              header === "id",
          );
          if (codeIndex === -1) {
            codeIndex = 0;
          }
          startIndex = 1;
        }
        // PARSE DATA TAPE
        const parsedData = [];
        for (let i = startIndex; i < lines.length; i++) {
          const columns = parseCSVLine(lines[i]);
          const code = columns[codeIndex];
          if (!code) continue;
          const cleanCode = code.replace(/^"|"$/g, "").trim();
          if (!cleanCode) continue;
          parsedData.push({
            code: cleanCode,
            row: i + 1,
            data: columns,
            headers: headers,
          });
        }

        
        // VALIDASI
        if (parsedData.length === 0) {
          throw new Error("Tidak ada kode tape yang ditemukan.");
        }

        
        // SIMPAN CSV
        setCsvData(parsedData);
        setCsvLoaded(true);
        setCsvFileName(file.name);
        setMatchedCount(0);

        // Reset hasil scan
        setResults([]);
        setMessage(`${parsedData.length} data tape berhasil dimuat.`);
        setError("");

        // Reset input supaya file yang sama
        // bisa dipilih kembali
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
      const url = URL.createObjectURL(file);

      const img = new Image();

      img.onload = async () => {
        try {
          const reader = new BrowserMultiFormatReader();

          const res = await reader.decodeFromImageElement(img);

          const text = res.getText()?.trim();

          const format = res.getBarcodeFormat()?.toString?.() || "UNKNOWN";

          const matchedTape = findTapeInCSV(text);

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
          URL.revokeObjectURL(url);

          setProcessingImage(false);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);

        setProcessingImage(false);

        setError("File gambar tidak dapat dibaca.");

        setMessage("Gagal membaca gambar.");
      };

      img.src = url;
    } catch (err) {
      console.error(err);

      setProcessingImage(false);

      setError("Terjadi kesalahan saat memproses foto.");

      setMessage("Gagal memproses foto.");
    }

    // Reset input
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
        {/* =================================
            HEADER
        ================================= */}

        <header className="header">
          <div className="logo">
            <ScanLine size={25} />
          </div>

          <div>
            <h1>Tape Disk Scanner</h1>

            <p>Cari tape berdasarkan data CSV</p>
          </div>
        </header>

        {/* =================================
            CSV
        ================================= */}

        <section className="csv-card">
          <div className="csv-header">
            <div className="csv-icon">
              <FileSpreadsheet size={22} />
            </div>

            <div>
              <strong>Data Pencarian Tape</strong>

              <span>Upload CSV berisi daftar tape yang ingin dicari</span>
            </div>
          </div>

          <input
            ref={csvRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(event) => {
              const file = event.target?.files?.[0];

              if (file) {
                handleCSVUpload(file);
              }
            }}
          />

          <button
            className="csv-upload-btn"
            onClick={() => csvRef.current?.click()}
          >
            <FileSpreadsheet size={19} />

            {csvLoaded ? "Ganti Data CSV" : "Upload Data CSV"}
          </button>

          {csvLoaded && (
            <div className="csv-loaded">
              <CheckCircle2 size={18} />

              <div>
                <strong>Data siap digunakan</strong>

                <span>
                  {csvFileName}
                  {" • "}
                  {csvData.length}
                  {" tape"}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* =================================
            SCANNER
        ================================= */}

        <section className="scanner-card">
          <div className="video-wrap">
            <video ref={videoRef} className="video" muted playsInline />

            {!scanning && !processingImage && (
              <div className="camera-placeholder">
                <ScanLine size={52} />

                <strong>Siap untuk scan</strong>

                <span>
                  {csvLoaded
                    ? "Arahkan kamera ke tape disk"
                    : "Upload CSV sebelum melakukan pencarian"}
                </span>
              </div>
            )}

            {processingImage && (
              <div className="camera-placeholder">
                <div className="loading-spinner">
                  <ScanLine size={45} />
                </div>

                <strong>Memproses foto...</strong>

                <span>Sedang mencari barcode</span>
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

                  <div className="scan-target">
                    <span>TAPE</span>

                    <strong>
                      {results.length}/{MAX_BARCODES}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="status">{message}</p>

          <div className="actions">
            {!scanning ? (
              <button
                className="primary"
                onClick={startScanner}
                disabled={processingImage}
              >
                <Camera size={20} />

                {results.length >= MAX_BARCODES ? "Scan Lagi" : "Buka Kamera"}
              </button>
            ) : (
              <button className="danger" onClick={stopScanner}>
                <CameraOff size={20} />
                Hentikan Kamera
              </button>
            )}

            <button
              className="secondary"
              disabled={processingImage}
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
              onChange={(event) => scanImage(event.target?.files?.[0])}
            />
          </div>
        </section>

        {/* =================================
            ERROR
        ================================= */}

        {error && (
          <div className="alert">
            <AlertCircle size={20} />

            <span>{error}</span>
          </div>
        )}

        {/* =================================
            SEARCH SUMMARY
        ================================= */}

        {csvLoaded && (
          <section className="search-summary">
            <div className="summary-item">
              <Database size={18} />

              <div>
                <small>DATA CSV</small>

                <strong>{csvData.length}</strong>
              </div>
            </div>

            <div className="summary-item">
              <CheckCircle2 size={18} />

              <div>
                <small>DITEMUKAN</small>

                <strong>{matchedCount}</strong>
              </div>
            </div>

            <div className="summary-item">
              <Search size={18} />

              <div>
                <small>DI SCAN</small>

                <strong>{results.length}</strong>
              </div>
            </div>
          </section>
        )}

        {/* =================================
            RESULT
        ================================= */}

        <section className="result-card">
          <div className="result-head">
            <div>
              <small>HASIL SCAN</small>

              <h2>
                {results.length === 0
                  ? "Belum ada hasil"
                  : `${results.length} tape terbaca`}
              </h2>
            </div>
          </div>

          {/* =================================
              RESULT LIST
          ================================= */}

          {results.length > 0 && (
            <div className="result-list">
              {results.map((item, index) => (
                <div
                  className={`barcode-item ${
                    item.found ? "tape-found" : "tape-not-found"
                  }`}
                  key={`${item.text}-${index}`}
                >
                  {/* NUMBER */}

                  <div className="barcode-number">{index + 1}</div>

                  {/* CONTENT */}

                  <div className="barcode-content">
                    <div className="barcode-text">{item.text}</div>

                    <div className="barcode-format">
                      {item.format}
                      {" • "}
                      {item.scannedAt}
                    </div>

                    {/* SEARCH STATUS */}

                    {csvLoaded ? (
                      item.found ? (
                        <div className="tape-status found">
                          <CheckCircle2 size={16} />

                          <strong>TAPE DISK DITEMUKAN</strong>
                        </div>
                      ) : (
                        <div className="tape-status not-found">
                          <XCircle size={16} />

                          <strong>TIDAK ADA DI DATA</strong>
                        </div>
                      )
                    ) : (
                      <div className="tape-status no-search">
                        <Search size={15} />

                        <span>Belum ada data pencarian</span>
                      </div>
                    )}

                    {/* CSV DATA */}

                    {item.found && item.csvData && (
                      <div className="csv-detail">
                        <span>Data CSV:</span>

                        <strong>{item.csvData.code}</strong>
                      </div>
                    )}
                  </div>

                  {/* ACTIONS */}
                  <div className="barcode-actions">
                    <button
                      className="small-btn"
                      onClick={() => copyResult(item.text, index)}
                      title="Salin"
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
                      title="Hapus"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <button className="reset" onClick={reset}>
          <RotateCcw size={17} />
          {results.length >= MAX_BARCODES ? "Scan Lagi" : "Reset Hasil"}
        </button>
        <footer>
          <span>Tape Disk</span>
          <span>•</span>
          <span>CSV Search</span>
          <span>•</span>
          <span>Scanner</span>
        </footer>
      </section>
    </main>
  );
}
// RENDER
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
