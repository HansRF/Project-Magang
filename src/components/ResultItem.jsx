import React from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";

function ResultItem({ item, index, copiedIndex, csvLoaded, onCopy, onDelete }) {
  return (
    <div
      className={`barcode-item ${item.found ? "tape-found" : "tape-not-found"}`}
      key={`${item.text}-${index}`}
    >
      <div className="barcode-number">{index + 1}</div>

      <div className="barcode-content">
        <div className="barcode-text">{item.text}</div>

        <div className="barcode-format">
          {item.format}
          {" • "}
          {item.scannedAt}
        </div>

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

        {item.found && item.csvData && (
          <div className="csv-detail">
            <span>Data CSV:</span>

            <strong>{item.csvData.code}</strong>
          </div>
        )}
      </div>

      <div className="barcode-actions">
        <button
          className="small-btn"
          onClick={() => onCopy(item.text, index)}
          title="Salin"
        >
          {copiedIndex === index ? <Check size={17} /> : <Copy size={17} />}
        </button>

        <button
          className="small-btn delete"
          onClick={() => onDelete(index)}
          title="Hapus"
        >
          <Trash2 size={17} />
        </button>
      </div>
    </div>
  );
}

export default ResultItem;
