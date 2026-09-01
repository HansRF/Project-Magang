import React from "react";
import ResultItem from "./ResultItem";

function ResultCard({ results, copiedIndex, csvLoaded, onCopy, onDelete }) {
  return (
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

      {results.length > 0 && (
        <div className="result-list">
          {results.map((item, index) => (
            <ResultItem
              key={`${item.text}-${index}`}
              item={item}
              index={index}
              copiedIndex={copiedIndex}
              csvLoaded={csvLoaded}
              onCopy={onCopy}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default ResultCard;
