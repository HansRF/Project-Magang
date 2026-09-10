import React, { useState } from "react";
import {
  X,
  Download,
  Upload,
  Database,
  LoaderCircle,
  Construction,
} from "lucide-react";

import * as XLSX from "xlsx";

import { getPindoTapes, getDCITapes } from "../utils/FirebaseTape";

function DataTransferModal({ onClose }) {
  const [exporting, setExporting] = useState(false);
  const [showImportProgress, setShowImportProgress] = useState(false);
  const [error, setError] = useState("");

  const handleExport = async () => {
    if (exporting) {
      return;
    }

    setError("");
    setExporting(true);

    try {
      const [pindoData, dciData] = await Promise.all([
        getPindoTapes(),
        getDCITapes(),
      ]);

      const pindoRows = pindoData.map((item) => ({
        Kode: item.code || item.id || "",
        Lokasi: "PINDO",
        ...item,
      }));

      const dciRows = dciData.map((item) => ({
        Kode: item.code || item.id || "",
        Lokasi: "DCI",
        ...item,
      }));

      const allData = [...pindoRows, ...dciRows];

      if (allData.length === 0) {
        setError("Tidak ada data Tape Disk di database.");
        return;
      }

      const cleanData = allData.map((item) => {
        const cleanItem = { ...item };

        delete cleanItem.id;

        return cleanItem;
      });

      const worksheet = XLSX.utils.json_to_sheet(cleanData);

      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheet, "Semua Data");

      const pindoSheet = XLSX.utils.json_to_sheet(
        pindoRows.map((item) => {
          const cleanItem = { ...item };
          delete cleanItem.id;
          return cleanItem;
        }),
      );

      XLSX.utils.book_append_sheet(workbook, pindoSheet, "PINDO");

      const dciSheet = XLSX.utils.json_to_sheet(
        dciRows.map((item) => {
          const cleanItem = { ...item };
          delete cleanItem.id;
          return cleanItem;
        }),
      );

      XLSX.utils.book_append_sheet(workbook, dciSheet, "DCI");

      const now = new Date();

      const date = now.toLocaleDateString("id-ID").replace(/\//g, "-");

      const time = now
        .toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
        .replace(/:/g, "-");

      XLSX.writeFile(workbook, `backup-tapedisk-${date}-${time}.xlsx`);
    } catch (err) {
      console.error("Export error:", err);

      setError("Gagal mengambil data dari database. Coba lagi.");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = () => {
    setShowImportProgress(true);
  };

  return (
    <>
      <div className="data-modal-backdrop" onClick={onClose}>
        <section
          className="data-modal"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="data-modal-header">
            <div className="data-modal-title">
              <div className="data-modal-icon">
                <Database size={22} />
              </div>

              <div>
                <h2>Data Tape Disk</h2>

                <p>Kelola data monitoring PINDO dan DCI</p>
              </div>
            </div>

            <button
              type="button"
              className="data-modal-close"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>

          <div className="data-modal-content">
            <button
              type="button"
              className="data-action-card"
              onClick={handleExport}
              disabled={exporting}
            >
              <div className="data-action-icon export">
                {exporting ? (
                  <LoaderCircle size={24} className="spin" />
                ) : (
                  <Download size={24} />
                )}
              </div>

              <div className="data-action-text">
                <strong>
                  {exporting ? "Menyiapkan Data..." : "Export Data"}
                </strong>

                <span>
                  Download semua data Tape Disk dari database PINDO dan DCI.
                </span>
              </div>
            </button>

            <button
              type="button"
              className="data-action-card"
              onClick={handleImport}
            >
              <div className="data-action-icon import">
                <Upload size={24} />
              </div>

              <div className="data-action-text">
                <strong>Import Data</strong>

                <span>Masukkan data Tape Disk ke database.</span>
              </div>
            </button>

            {error && <div className="data-modal-error">{error}</div>}
          </div>

          <div className="data-modal-footer">
            <button
              type="button"
              className="data-modal-cancel"
              onClick={onClose}
            >
              Tutup
            </button>
          </div>
        </section>
      </div>

      {showImportProgress && (
        <div className="data-modal-backdrop import-progress-backdrop">
          <section className="progress-modal">
            <div className="progress-icon">
              <Construction size={32} />
            </div>

            <h2>Import Data</h2>

            <p>Fitur import data masih dalam tahap pengembangan.</p>

            <span className="progress-badge">UNDER PROGRESS</span>

            <button
              type="button"
              className="data-modal-cancel"
              onClick={() => setShowImportProgress(false)}
            >
              Mengerti
            </button>
          </section>
        </div>
      )}
    </>
  );
}

export default DataTransferModal;
