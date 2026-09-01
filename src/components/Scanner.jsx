import React from "react";
import { Camera, CameraOff, ImagePlus, ScanLine } from "lucide-react";

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
            className="primary"
            onClick={onStartScanner}
            disabled={processingImage}
          >
            <Camera size={20} />

            {resultsLength >= maxBarcodes ? "Scan Lagi" : "Buka Kamera"}
          </button>
        ) : (
          <button className="danger" onClick={onStopScanner}>
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
          onChange={(event) => onScanImage(event.target?.files?.[0])}
        />
      </div>
    </section>
  );
}

export default Scanner;
