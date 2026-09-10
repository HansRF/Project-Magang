import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  ImagePlus,
  ScanLine,
  X,
  RotateCcw,
} from "lucide-react";

function Scanner({
  videoRef,
  fileRef,
  scanning,
  processingImage,
  resultsLength,
  maxBarcodes,
  csvLoaded,
  message,
  onStartScanner,
  onStopScanner,
  onScanImage,
}) {
  const photoVideoRef = useRef(null);
  const photoStreamRef = useRef(null);

  const [photoMode, setPhotoMode] = useState(false);
  const [photoReady, setPhotoReady] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [facingMode, setFacingMode] = useState("environment");

  const stopPhotoCamera = () => {
    if (photoStreamRef.current) {
      photoStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });

      photoStreamRef.current = null;
    }

    if (photoVideoRef.current) {
      photoVideoRef.current.srcObject = null;
    }

    setPhotoReady(false);
  };

  const startPhotoCamera = async () => {
    if (!csvLoaded) {
      return;
    }

    if (scanning) {
      onStopScanner();
    }

    stopPhotoCamera();

    setPhotoError("");
    setPhotoMode(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: {
            ideal: facingMode,
          },
          width: {
            ideal: 1920,
          },
          height: {
            ideal: 1080,
          },
        },
      });

      photoStreamRef.current = stream;

      if (photoVideoRef.current) {
        photoVideoRef.current.srcObject = stream;

        await photoVideoRef.current.play();

        setPhotoReady(true);
      }
    } catch (error) {
      console.error("Photo camera error:", error);

      setPhotoMode(false);
      setPhotoReady(false);

      setPhotoError(
        "Kamera tidak bisa digunakan. Pastikan izin kamera diberikan.",
      );

      stopPhotoCamera();
    }
  };

  const switchCamera = async () => {
    const newFacingMode = facingMode === "environment" ? "user" : "environment";

    setFacingMode(newFacingMode);

    stopPhotoCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: {
            exact: newFacingMode,
          },
          width: {
            ideal: 1920,
          },
          height: {
            ideal: 1080,
          },
        },
      });

      photoStreamRef.current = stream;

      if (photoVideoRef.current) {
        photoVideoRef.current.srcObject = stream;

        await photoVideoRef.current.play();

        setPhotoReady(true);
      }
    } catch (error) {
      console.error("Switch camera error:", error);

      setPhotoError("Gagal mengganti kamera.");

      setTimeout(() => {
        startPhotoCamera();
      }, 300);
    }
  };

  const takePhoto = () => {
    if (!photoVideoRef.current || !photoReady) {
      return;
    }

    if (resultsLength >= maxBarcodes) {
      setPhotoError(`${maxBarcodes} barcode sudah selesai dipindai.`);

      return;
    }

    const video = photoVideoRef.current;

    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const context = canvas.getContext("2d");

    if (!context) {
      setPhotoError("Gagal mengambil foto.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setPhotoError("Gagal membuat foto.");
          return;
        }

        const file = new File([blob], `tapedisk-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        stopPhotoCamera();
        setPhotoMode(false);

        onScanImage(file);
      },
      "image/jpeg",
      0.95,
    );
  };

  const closePhotoCamera = () => {
    stopPhotoCamera();
    setPhotoMode(false);
    setPhotoError("");
  };

  useEffect(() => {
    return () => {
      stopPhotoCamera();
    };
  }, []);

  /*
   * ==========================================
   * MODE AMBIL FOTO
   * ==========================================
   */

  if (photoMode) {
    return (
      <section className="scanner-card photo-camera-card">
        <div className="photo-camera-wrap">
          <video
            ref={photoVideoRef}
            className="photo-camera-video"
            muted
            playsInline
          />

          {!photoReady && (
            <div className="camera-placeholder photo-loading">
              <ScanLine size={48} />

              <strong>Membuka kamera...</strong>

              <span>Mohon izinkan akses kamera</span>
            </div>
          )}

          {/* HEADER KAMERA */}

          <div className="photo-camera-top">
            <button
              type="button"
              className="photo-camera-close"
              onClick={closePhotoCamera}
            >
              <X size={22} />
            </button>

            <div className="photo-camera-title">
              <span>AMBIL FOTO</span>

              <strong>
                {resultsLength}/{maxBarcodes} BARCODE
              </strong>
            </div>

            <button
              type="button"
              className="photo-camera-switch"
              onClick={switchCamera}
              disabled={!photoReady}
            >
              <RotateCcw size={20} />
            </button>
          </div>

          {/* BINGKAI FULL */}

          <div className="photo-scan-overlay">
            <div className="photo-scan-box">
              <span className="corner tl" />
              <span className="corner tr" />
              <span className="corner bl" />
              <span className="corner br" />

              <div className="photo-scan-label">
                Posisikan barcode di dalam area
              </div>
            </div>
          </div>

          {/* BOTTOM CAMERA */}

          <div className="photo-camera-bottom">
            <div className="photo-count">
              <ScanLine size={16} />

              <span>{resultsLength} barcode berhasil di-scan</span>
            </div>

            <button
              type="button"
              className="photo-shutter"
              onClick={takePhoto}
              disabled={
                !photoReady || processingImage || resultsLength >= maxBarcodes
              }
              aria-label="Jepret foto"
            >
              <span />
            </button>

            <div className="photo-counter-bottom">
              {resultsLength}/{maxBarcodes}
            </div>
          </div>
        </div>

        {photoError && <p className="status photo-error">{photoError}</p>}

        <p className="status">
          Arahkan barcode ke area kamera lalu tekan tombol jepret.
        </p>
      </section>
    );
  }

  /*
   * ==========================================
   * MODE SCANNER REALTIME
   * ==========================================
   */

  return (
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
                  {resultsLength}/{maxBarcodes}
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
            type="button"
            className="primary"
            onClick={onStartScanner}
            disabled={processingImage || !csvLoaded}
          >
            <Camera size={20} />

            {resultsLength >= maxBarcodes ? "Scan Lagi" : "Buka Kamera"}
          </button>
        ) : (
          <button type="button" className="danger" onClick={onStopScanner}>
            <CameraOff size={20} />
            Hentikan Kamera
          </button>
        )}

        <button
          type="button"
          className="secondary"
          disabled={processingImage || !csvLoaded}
          onClick={startPhotoCamera}
        >
          <Camera size={20} />
          Ambil Foto
        </button>

        <button
          type="button"
          className="secondary"
          disabled={processingImage || !csvLoaded}
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
          onChange={(event) => {
            const file = event.target?.files?.[0];

            if (file) {
              onScanImage(file);
            }

            event.target.value = "";
          }}
        />
      </div>
    </section>
  );
}

export default Scanner;
