import React, { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";

import { findTapeInCSV, normalizeCode, parseTapeFile } from "./utils/csv";

import {
  createScanner,
  getBarcodeFormat,
  getBarcodeText,
  scanImageFile,
} from "./utils/scanner";

import {
  getTapeLocation,
  validateTapesBeforeScan,
  moveTapesToDestination,
} from "./utils/FirebaseTape";

import {
  Database,
  CheckCircle2,
  Search,
  X,
  MapPin,
  AlertTriangle,
  Check,
  Loader2,
} from "lucide-react";

import Login from "./components/Login";
import DataTransferModal from "./components/DataTransferModal";
import Header from "./components/Header";
import CSVUpload from "./components/CSVupload";
import Scanner from "./components/Scanner";
import ErrorAlert from "./components/ErrorAlert";
import ResultCard from "./components/ResultCard";
import Footer from "./components/Footer";
import Monitor from "./components/Monitor";

const MAX_BARCODES = 50;

function App() {
  // =========================================================
  // AUTH
  // =========================================================
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState("scanner");

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
    "Upload data CSV atau Excel terlebih dahulu, lalu mulai scan.",
  );
  const [error, setError] = useState("");

  // =========================================================
  // CSV / EXCEL STATE
  // =========================================================
  const [csvData, setCsvData] = useState([]);
  const [csvLoaded, setCsvLoaded] = useState(false);
  const [csvFileName, setCsvFileName] = useState("");
  const [showDataTransfer, setShowDataTransfer] = useState(false);

  // =========================================================
  // MATCHED COUNT
  // =========================================================
  const [matchedCount, setMatchedCount] = useState(0);

  // =========================================================
  // DATABASE VALIDATION
  // =========================================================
  const [databaseChecking, setDatabaseChecking] = useState(false);
  const [databaseCheck, setDatabaseCheck] = useState(null);

  // Tujuan dipilih SEBELUM scan
  const [destination, setDestination] = useState(null);

  // Popup pilih tujuan
  const [validationModal, setValidationModal] = useState(false);

  // =========================================================
  // POPUP KONFIRMASI PINDAH
  // =========================================================
  const [completionModal, setCompletionModal] = useState(false);
  const [movingData, setMovingData] = useState(false);

  // =========================================================
  // POPUP BERHASIL
  // =========================================================
  const [moveSuccess, setMoveSuccess] = useState(false);

  // =========================================================
  // CEK LOGIN
  // =========================================================
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // =========================================================
  // LOGOUT
  // =========================================================
  const handleLogout = async () => {
    try {
      stopScanner();

      await signOut(auth);

      setResults([]);
      setCsvData([]);
      setCsvLoaded(false);
      setCsvFileName("");
      setMatchedCount(0);
      setError("");

      setMessage(
        "Upload data CSV atau Excel terlebih dahulu, lalu mulai scan.",
      );

      setDatabaseCheck(null);
      setDestination(null);
      setValidationModal(false);
      setCompletionModal(false);
      setMoveSuccess(false);
    } catch (err) {
      console.error("Logout error:", err);
      setError("Gagal logout. Silakan coba lagi.");
    }
  };

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
  // CEK DATABASE SETELAH UPLOAD
  // =========================================================
  const checkUploadedData = async (parsedData) => {
    if (!parsedData || parsedData.length === 0) {
      return;
    }

    setDatabaseChecking(true);
    setValidationModal(false);
    setCompletionModal(false);
    setMoveSuccess(false);
    setDestination(null);
    setDatabaseCheck(null);

    setMessage("Mengecek data Tape Disk ke database monitoring...");

    try {
      const validation = await validateTapesBeforeScan(parsedData);

      const pindo = validation.filter((item) => item.location === "PINDO");

      const dci = validation.filter((item) => item.location === "DCI");

      const notFound = validation.filter(
        (item) => item.location === "TIDAK_DITEMUKAN",
      );

      const checkResult = {
        total: validation.length,
        pindo,
        dci,
        notFound,
        all: validation,
      };

      setDatabaseCheck(checkResult);

      // =====================================================
      // POPUP PILIH TUJUAN TETAP MUNCUL SETELAH UPLOAD
      // =====================================================
      setValidationModal(true);

      setMessage(
        `${validation.length} data selesai dicek dari database monitoring.`,
      );
    } catch (err) {
      console.error("Database validation error:", err);

      setError(
        "Gagal mengecek data Tape Disk dari Firebase. Pastikan Firestore Rules sudah benar.",
      );

      setMessage("Gagal mengecek database monitoring.");
    } finally {
      setDatabaseChecking(false);
    }
  };

  // =========================================================
  // CEK APAKAH SEMUA DATA SUDAH DI-SCAN
  // =========================================================
  const checkAllTapesScanned = (currentResults = results) => {
    if (!databaseCheck?.all || databaseCheck.all.length === 0) {
      return false;
    }

    const requiredCodes = [
      ...new Set(
        databaseCheck.all
          .map((item) => normalizeCode(item?.code || ""))
          .filter(Boolean),
      ),
    ];

    const scannedCodes = new Set(
      currentResults
        .filter(
          (item) =>
            item.found === true &&
            (item.location === "PINDO" || item.location === "DCI"),
        )
        .map((item) => normalizeCode(item.text))
        .filter(Boolean),
    );

    return (
      requiredCodes.length > 0 &&
      requiredCodes.every((code) => scannedCodes.has(code))
    );
  };

  // =========================================================
  // VALIDASI TUJUAN
  // =========================================================
  const handleDestinationSelect = (target) => {
    if (!databaseCheck) {
      return;
    }

    setDestination(target);

    const wrongLocation =
      target === "DCI"
        ? [...databaseCheck.dci, ...databaseCheck.notFound]
        : [...databaseCheck.pindo, ...databaseCheck.notFound];

    if (wrongLocation.length > 0) {
      setMessage(
        `⚠️ Ada ${wrongLocation.length} Tape Disk yang tidak sesuai untuk dibawa ke ${target}.`,
      );

      return;
    }

    setMessage(
      `✅ Semua ${databaseCheck.total} Tape Disk sesuai untuk dibawa ke ${target}.`,
    );
  };

  // =========================================================
  // BUKA POPUP KONFIRMASI SETELAH SEMUA SCAN SELESAI
  // =========================================================
  const openCompletionConfirmation = (currentResults) => {
    if (!databaseCheck) {
      return;
    }

    if (!destination) {
      setError("Pilih lokasi tujuan terlebih dahulu sebelum melakukan scan.");

      setMessage("⚠️ Pilih tujuan PINDO atau DCI terlebih dahulu.");

      return;
    }

    const allScanned = checkAllTapesScanned(currentResults);

    if (!allScanned) {
      return;
    }

    // Scanner berhenti karena semua tape sudah ditemukan
    stopScanner();

    setError("");

    setMessage(`✅ Semua ${databaseCheck.total} Tape Disk berhasil ditemukan.`);

    // =====================================================
    // POPUP KONFIRMASI PINDAH
    // =====================================================
    setCompletionModal(true);
  };

  // =========================================================
  // KONFIRMASI PINDAH DATA
  // =========================================================
  const handleMoveData = async () => {
    if (!databaseCheck) {
      return;
    }

    if (!destination) {
      setError("Lokasi tujuan belum dipilih.");
      return;
    }

    if (!checkAllTapesScanned(results)) {
      setError("Belum semua Tape Disk berhasil di-scan.");

      setMessage(
        "⚠️ Semua Tape Disk harus ditemukan melalui proses scan terlebih dahulu.",
      );

      return;
    }

    if (!databaseCheck.all || databaseCheck.all.length === 0) {
      setError("Tidak ada data Tape Disk untuk dipindahkan.");

      return;
    }

    setMovingData(true);
    setError("");

    try {
      setMessage(
        `Memindahkan ${databaseCheck.total} Tape Disk ke ${destination}...`,
      );

      await moveTapesToDestination(databaseCheck.all, destination);

      // Tutup popup konfirmasi
      setCompletionModal(false);

      // Buka popup berhasil
      setMoveSuccess(true);

      setMessage(
        `✅ ${databaseCheck.total} Tape Disk berhasil dipindahkan ke ${destination}.`,
      );
    } catch (err) {
      console.error("Move Tape Disk error:", err);

      setError(err?.message || "Gagal memindahkan data Tape Disk.");

      setMessage(
        "❌ Data gagal dipindahkan. Tidak ada perubahan yang berhasil diselesaikan pada proses ini.",
      );
    } finally {
      setMovingData(false);
    }
  };

  // =========================================================
  // ADD SCAN RESULT
  // =========================================================
  const addScanResult = async (text, format) => {
    if (!text) {
      return;
    }

    const normalized = normalizeCode(text);

    // Cek duplicate
    const alreadyExists = results.some(
      (item) => normalizeCode(item.text) === normalized,
    );

    if (alreadyExists) {
      setMessage(`Barcode ${text} sudah ada di hasil scan.`);

      return;
    }

    if (results.length >= MAX_BARCODES) {
      setMessage(`${MAX_BARCODES} tape sudah selesai dipindai.`);

      return;
    }

    if (!csvLoaded || csvData.length === 0) {
      setError("Upload data CSV atau Excel terlebih dahulu.");

      setMessage("Data pencarian belum dimuat.");

      return;
    }

    setError("");
    setMessage(`Mengecek ${text}...`);

    try {
      const matchedTape = findTapeInCSV(csvData, text);

      const firebaseLocation = await getTapeLocation(text);

      const successfullyFound =
        Boolean(matchedTape) &&
        (firebaseLocation.location === "PINDO" ||
          firebaseLocation.location === "DCI");

      const newItem = {
        text,
        format,
        found: Boolean(matchedTape),
        csvData: matchedTape || null,
        location: firebaseLocation.location,
        firebaseData: firebaseLocation.data || null,
        scannedAt: new Date().toLocaleTimeString("id-ID"),
      };

      // =====================================================
      // MASUKKAN HASIL SCAN
      // =====================================================
      const nextResults = [...results, newItem];

      setResults((previousResults) => {
        const duplicate = previousResults.some(
          (item) => normalizeCode(item.text) === normalized,
        );

        if (duplicate) {
          return previousResults;
        }

        return [...previousResults, newItem];
      });

      // =====================================================
      // TIDAK ADA DI FILE PENCARIAN
      // =====================================================
      if (!matchedTape) {
        setMessage(`❌ TAPE TIDAK ADA DI DAFTAR PENCARIAN — ${text}`);

        return;
      }

      // =====================================================
      // ADA DI FILE, TAPI TIDAK ADA DI FIREBASE
      // =====================================================
      if (!successfullyFound) {
        setMessage(
          `⚠️ ${text} ada di daftar pencarian, tetapi belum ada di database monitoring.`,
        );

        return;
      }

      // =====================================================
      // BERHASIL DITEMUKAN
      // =====================================================
      setMatchedCount((previous) => previous + 1);

      if (firebaseLocation.location === "PINDO") {
        setMessage(`✅ TAPE DISK DITEMUKAN ${text} LOKASI: PINDO`);
      } else if (firebaseLocation.location === "DCI") {
        setMessage(`✅ TAPE DISK DITEMUKAN ${text} LOKASI: DCI`);
      }

      // =====================================================
      // CEK APAKAH SEMUA TAPE SUDAH DITEMUKAN
      // =====================================================
      const allScanned = checkAllTapesScanned(nextResults);

      if (allScanned) {
        // ===================================================
        // JANGAN PINDAHKAN DATA OTOMATIS
        //
        // CUMA MUNCULKAN POPUP KONFIRMASI
        // ===================================================
        setTimeout(() => {
          openCompletionConfirmation(nextResults);
        }, 400);

        return;
      }

      // =====================================================
      // JIKA BELUM SEMUA, LANJUT SCAN
      // =====================================================
      if (nextResults.length >= MAX_BARCODES) {
        setTimeout(() => {
          stopScanner();

          setMessage(
            `${MAX_BARCODES} tape selesai dipindai. Cek hasil di bawah.`,
          );
        }, 500);
      }
    } catch (err) {
      console.error("Scan Firebase error:", err);

      setError("Gagal mengecek lokasi Tape Disk dari Firebase.");

      setMessage("Terjadi kesalahan saat membaca database.");
    }
  };

  // =========================================================
  // HANDLE BARCODE CAMERA
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

    addScanResult(text, format);
  };

  // =========================================================
  // START CAMERA
  // =========================================================
  const startScanner = async () => {
    if (scanning) {
      return;
    }

    if (!csvLoaded || csvData.length === 0) {
      setError(
        "Upload data CSV atau Excel terlebih dahulu sebelum melakukan scan.",
      );

      setMessage("Data pencarian belum dimuat.");

      return;
    }

    if (!destination) {
      setError("Pilih lokasi tujuan terlebih dahulu.");

      setMessage("⚠️ Pilih tujuan PINDO atau DCI sebelum melakukan scan.");

      setValidationModal(true);

      return;
    }

    if (results.length >= MAX_BARCODES) {
      setMessage(
        `${MAX_BARCODES} tape sudah selesai dipindai. Tekan Scan Lagi.`,
      );

      return;
    }

    stopScanner();

    setError("");
    setMessage("Meminta akses kamera...");
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
        `Kamera aktif — arahkan ke tape. ${results.length}/${MAX_BARCODES} terbaca.`,
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

      if (!Array.isArray(parsedData)) {
        throw new Error("Hasil pembacaan file bukan array.");
      }

      if (parsedData.length === 0) {
        throw new Error("File tidak memiliki data tape.");
      }

      if (parsedData.length > MAX_BARCODES) {
        throw new Error(`Maksimal ${MAX_BARCODES} Tape Disk dalam satu file.`);
      }

      // =====================================================
      // RESET DATA LAMA
      // =====================================================
      setCsvData(parsedData);
      setCsvLoaded(true);
      setCsvFileName(file.name);

      setResults([]);
      setMatchedCount(0);

      setDestination(null);
      setCompletionModal(false);
      setMoveSuccess(false);

      setError("");

      if (csvRef.current) {
        csvRef.current.value = "";
      }

      setMessage(
        `${parsedData.length} data tape berhasil dimuat. Sedang mengecek database...`,
      );

      // =====================================================
      // CEK FIRESTORE
      // =====================================================
      await checkUploadedData(parsedData);
    } catch (err) {
      console.error("File data error:", err);

      setCsvData([]);
      setCsvLoaded(false);
      setCsvFileName("");
      setMatchedCount(0);
      setResults([]);

      setDatabaseCheck(null);
      setDestination(null);
      setValidationModal(false);
      setCompletionModal(false);

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

    if (!csvLoaded || csvData.length === 0) {
      setError("Upload data CSV atau Excel terlebih dahulu.");

      return;
    }

    if (!destination) {
      setError("Pilih lokasi tujuan terlebih dahulu.");

      setValidationModal(true);

      return;
    }

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

      await addScanResult(text, format);
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

    setCompletionModal(false);

    setMoveSuccess(false);

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
  // AUTH LOADING
  // =========================================================
  if (authLoading) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="login-logo">
            <Database size={32} />
          </div>

          <div className="login-header">
            <h1>Tape Disk Scanner</h1>

            <p>Memeriksa sesi login...</p>
          </div>

          <div className="login-security">Memuat aplikasi...</div>
        </section>
      </main>
    );
  }

  // =========================================================
  // BELUM LOGIN
  // =========================================================
  if (!user) {
    return (
      <Login
        onLogin={(loggedUser) => {
          setUser(loggedUser);
        }}
      />
    );
  }

  // =========================================================
  // HALAMAN MONITOR
  // =========================================================
  if (currentPage === "monitor") {
    return (
      <main className="app">
        <section className="shell">
          <Monitor onBack={() => setCurrentPage("scanner")} />
        </section>
      </main>
    );
  }

  // =========================================================
  // MAIN APP
  // =========================================================
  return (
    <main className="app">
      <section className="shell">
        <Header />

        {/* ==================================================
            BUTTON
        ================================================== */}
        <div className="data-transfer-button-wrap">
          <button
            type="button"
            className="data-transfer-button"
            onClick={() => setShowDataTransfer(true)}
          >
            <Database size={19} />

            <span>Import / Export Data</span>
          </button>

          <button
            type="button"
            className="monitor-button"
            onClick={() => {
              stopScanner();
              setCurrentPage("monitor");
            }}
          >
            <Search size={19} />

            <span>Monitor Database</span>
          </button>
        </div>

        {/* ==================================================
            UPLOAD DATA
        ================================================== */}
        <CSVUpload
          csvRef={csvRef}
          csvLoaded={csvLoaded}
          csvFileName={csvFileName}
          csvData={csvData}
          onUpload={handleCSVUpload}
        />

        {/* ==================================================
            STATUS DATABASE
        ================================================== */}
        {databaseChecking && (
          <section className="database-checking">
            <div className="database-checking-icon">
              <Database size={22} />
            </div>

            <div>
              <strong>Mengecek Database Monitoring</strong>

              <span>Sedang mencocokkan data PINDO dan DCI...</span>
            </div>
          </section>
        )}

        {/* ==================================================
            SCANNER
        ================================================== */}
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

        {/* ==================================================
            SUMMARY
        ================================================== */}
        {csvLoaded && (
          <section className="search-summary">
            <div className="summary-item">
              <Database size={20} />

              <div>
                <small>DATA PENCARIAN</small>

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

        {/* ==================================================
            HASIL SCAN
        ================================================== */}
        <ResultCard
          results={results}
          copiedIndex={copiedIndex}
          csvLoaded={csvLoaded}
          onCopy={copyResult}
          onDelete={deleteResult}
        />

        {/* ==================================================
            RESET
        ================================================== */}
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

        {/* ==================================================
            LOGOUT
        ================================================== */}
        <button type="button" className="logout-button" onClick={handleLogout}>
          <span className="logout-icon">↪</span>

          <span>Logout</span>
        </button>

        <Footer />

        {showDataTransfer && (
          <DataTransferModal onClose={() => setShowDataTransfer(false)} />
        )}
      </section>

      {/* ====================================================
          MODAL 1 — PILIH TUJUAN
          MUNCUL SETELAH UPLOAD
      ==================================================== */}
      {validationModal && databaseCheck && (
        <div className="validation-overlay">
          <section className="validation-modal">
            <button
              type="button"
              className="validation-close"
              onClick={() => setValidationModal(false)}
            >
              <X size={20} />
            </button>

            <div className="validation-icon">
              <Database size={30} />
            </div>

            <h2>Data Tape Disk Sudah Dicek</h2>

            <p className="validation-description">
              Sistem sudah mencocokkan data yang di-upload dengan database
              monitoring PINDO dan DCI.
            </p>

            {/* SUMMARY */}
            <div className="validation-summary">
              <div>
                <strong>{databaseCheck.total}</strong>

                <span>Total</span>
              </div>

              <div>
                <strong>{databaseCheck.pindo.length}</strong>

                <span>PINDO</span>
              </div>

              <div>
                <strong>{databaseCheck.dci.length}</strong>

                <span>DCI</span>
              </div>

              <div>
                <strong>{databaseCheck.notFound.length}</strong>

                <span>Tidak Ada</span>
              </div>
            </div>

            {/* PILIH TUJUAN */}
            <div className="destination-title">
              <MapPin size={18} />

              <strong>Data ini akan dibawa ke mana?</strong>
            </div>

            <div className="destination-buttons">
              {/* PINDO */}
              <button
                type="button"
                className={
                  destination === "PINDO"
                    ? "destination-button active"
                    : "destination-button"
                }
                onClick={() => handleDestinationSelect("PINDO")}
              >
                <Database size={20} />

                <span>
                  <strong>Bawa ke PINDO</strong>

                  <small>Semua tape harus berada di DCI</small>
                </span>
              </button>

              {/* DCI */}
              <button
                type="button"
                className={
                  destination === "DCI"
                    ? "destination-button active"
                    : "destination-button"
                }
                onClick={() => handleDestinationSelect("DCI")}
              >
                <Database size={20} />

                <span>
                  <strong>Bawa ke DCI</strong>

                  <small>Semua tape harus berada di PINDO</small>
                </span>
              </button>
            </div>

            {/* HASIL VALIDASI */}
            {destination && (
              <div
                className={
                  (destination === "DCI"
                    ? databaseCheck.dci.length + databaseCheck.notFound.length
                    : databaseCheck.pindo.length +
                      databaseCheck.notFound.length) > 0
                    ? "validation-result warning"
                    : "validation-result success"
                }
              >
                {(destination === "DCI"
                  ? databaseCheck.dci.length + databaseCheck.notFound.length
                  : databaseCheck.pindo.length +
                    databaseCheck.notFound.length) > 0 ? (
                  <>
                    <div className="validation-result-header">
                      <AlertTriangle size={20} />

                      <strong>Data tidak sesuai</strong>
                    </div>

                    <p>
                      Tape berikut tidak sesuai untuk dibawa ke {destination}:
                    </p>

                    <div className="wrong-tape-list">
                      {(destination === "DCI"
                        ? [...databaseCheck.dci, ...databaseCheck.notFound]
                        : [...databaseCheck.pindo, ...databaseCheck.notFound]
                      ).map((item, index) => (
                        <div
                          className="wrong-tape-item"
                          key={`${item.code}-${index}`}
                        >
                          <X size={15} />

                          <div>
                            <strong>{item.code}</strong>

                            <span>
                              {item.location === "TIDAK_DITEMUKAN"
                                ? "Tidak ada di database monitoring"
                                : `Saat ini terdaftar di ${item.location}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="validation-warning-note">
                      Data belum dapat dibawa ke {destination} karena masih ada
                      Tape Disk yang tidak sesuai.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="validation-result-header">
                      <Check size={20} />

                      <strong>Semua data sesuai</strong>
                    </div>

                    <p>
                      Semua {databaseCheck.total} Tape Disk sudah berada di
                      database {destination === "DCI" ? "PINDO" : "DCI"} dan
                      sesuai untuk dibawa ke {destination}.
                    </p>

                    <div className="validation-success-note">
                      <CheckCircle2 size={17} />
                      Data siap digunakan untuk proses pencarian dan monitoring.
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              type="button"
              className="validation-close-button"
              onClick={() => setValidationModal(false)}
            >
              Tutup
            </button>
          </section>
        </div>
      )}

      {/* ====================================================
          MODAL 2 — KONFIRMASI SETELAH SEMUA SCAN
      ==================================================== */}
      {completionModal && databaseCheck && destination && (
        <div className="validation-overlay">
          <section className="validation-modal move-confirm-modal">
            <div className="validation-icon">
              <CheckCircle2 size={30} />
            </div>

            <h2>Semua Tape Disk Berhasil Ditemukan</h2>

            <p className="validation-description">
              Seluruh Tape Disk pada data pencarian sudah berhasil ditemukan
              melalui proses scan.
            </p>

            <div className="validation-summary">
              <div>
                <strong>{databaseCheck.total}</strong>

                <span>Tape Ditemukan</span>
              </div>

              <div>
                <strong>{destination}</strong>

                <span>Tujuan</span>
              </div>
            </div>

            <div className="move-confirm-warning">
              <AlertTriangle size={21} />

              <div>
                <strong>Data akan dipindahkan </strong>

                <span>
                  Setelah tombol konfirmasi ditekan, data {databaseCheck.total}{" "}
                  Tape Disk akan dipindahkan dari{" "}
                  {destination === "DCI" ? "PINDO" : "DCI"} ke {destination}{" "}
                  pada database monitoring.
                </span>
              </div>
            </div>

            <div className="move-confirm-actions">
              <button
                type="button"
                className="validation-close-button secondary"
                disabled={movingData}
                onClick={() => setCompletionModal(false)}
              >
                Batal
              </button>

              <button
                type="button"
                className="validation-close-button primary"
                disabled={movingData}
                onClick={handleMoveData}
              >
                {movingData ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    Memindahkan...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Konfirmasi & Pindahkan
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ====================================================
          MODAL 3 — BERHASIL
      ==================================================== */}
      {moveSuccess && databaseCheck && destination && (
        <div className="validation-overlay">
          <section className="validation-modal move-success-modal">
            <div className="validation-icon success">
              <CheckCircle2 size={34} />
            </div>

            <h2>Berhasil Dipindahkan</h2>

            <p className="validation-description">
              Data Tape Disk berhasil diperbarui pada database monitoring.
            </p>

            <div className="move-success-count">
              <strong>{databaseCheck.total}</strong>

              <span>Tape Disk berhasil dipindahkan</span>
            </div>

            <div className="move-success-location">
              <div>
                <small>DARI {destination === "DCI" ? "PINDO" : "DCI"}</small>
              </div>

              <span>→</span>

              <div>
                <small>KE {destination}</small>
              </div>
            </div>

            <div className="move-refresh-note">
              Database monitoring sudah diperbarui.
            </div>

            <button
              type="button"
              className="validation-close-button full"
              onClick={() => window.location.reload()}
            >
              Selesai
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
