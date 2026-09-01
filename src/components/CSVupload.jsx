import React from "react";
import { CheckCircle2, FileSpreadsheet } from "lucide-react";

function CSVUpload({ csvRef, csvLoaded, csvFileName, csvData, onUpload }) {
  return (
    <section className="csv-card">
      <div className="csv-header">
        <div className="csv-icon">
          <FileSpreadsheet size={22} />
        </div>

        <div>
          <strong>Data Pencarian Tape</strong>
          <span>
            Upload CSV atau Excel berisi daftar tape yang ingin dicari
          </span>
        </div>
      </div>

      <input
        ref={csvRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        hidden
        onChange={(event) => {
          const file = event.target?.files?.[0];

          if (file) {
            onUpload(file);
          }
        }}
      />

      <button
        type="button"
        className="csv-upload-btn"
        onClick={() => csvRef.current?.click()}
      >
        <FileSpreadsheet size={19} />

        {csvLoaded ? "Ganti Data" : "Upload Data CSV / Excel"}
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
  );
}

export default CSVUpload;
