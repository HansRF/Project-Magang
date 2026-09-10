import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Database,
  HardDrive,
  MapPin,
  RefreshCw,
  Search,
  Server,
  ArrowLeft,
} from "lucide-react";

import { subscribeTapeMonitoring } from "../utils/FirebaseTape";

const Monitor = ({ onBack }) => {
  const [data, setData] = useState({
    pindo: [],
    dci: [],
    total: 0,
  });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("SEMUA");
  const [loading, setLoading] = useState(true);

  // =========================================================
  // REALTIME FIRESTORE
  // =========================================================

  useEffect(() => {
    setLoading(true);

    const unsubscribe = subscribeTapeMonitoring((result) => {
      setData(result);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // =========================================================
  // GABUNG DATA
  // =========================================================

  const allTapes = useMemo(() => {
    return [...data.pindo, ...data.dci];
  }, [data.pindo, data.dci]);

  // =========================================================
  // SEARCH + FILTER
  // =========================================================

  const filteredTapes = useMemo(() => {
    const keyword = search.trim().toUpperCase();

    return allTapes.filter((tape) => {
      const code = String(
        tape.code ||
          tape.tapedisk ||
          tape.kode ||
          tape.barcode ||
          tape.serial ||
          tape.id ||
          "",
      ).toUpperCase();

      const searchMatch = code.includes(keyword);

      const locationMatch = filter === "SEMUA" || tape.location === filter;

      return searchMatch && locationMatch;
    });
  }, [allTapes, search, filter]);

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="monitor-page">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="monitor-header">
        <div className="monitor-heading">
          <button
            type="button"
            className="monitor-back-icon"
            onClick={onBack}
            title="Kembali ke Scanner"
          >
            <ArrowLeft size={19} />
          </button>

          <div className="monitor-title-icon">
            <Activity size={23} />
          </div>

          <div>
            <h1>Monitor Tape Disk</h1>
            <p>Monitoring data Tape Disk secara realtime</p>
          </div>
        </div>

        <div className="monitor-header-right">
          <div className="monitor-live">
            <span className="monitor-live-dot"></span>
            LIVE
          </div>

          <button
            type="button"
            className="monitor-back-button"
            onClick={onBack}
          >
            <ArrowLeft size={17} />
            Kembali
          </button>
        </div>
      </header>

      {/* =====================================================
          STATISTIC
      ====================================================== */}

      <section className="monitor-stats">
        <div className="monitor-stat-card monitor-total">
          <div className="monitor-stat-icon">
            <Database size={22} />
          </div>

          <div className="monitor-stat-info">
            <span>Total Tape Disk</span>
            <strong>{data.total}</strong>
            <small>Seluruh database</small>
          </div>
        </div>

        <div className="monitor-stat-card monitor-pindo">
          <div className="monitor-stat-icon">
            <MapPin size={22} />
          </div>

          <div className="monitor-stat-info">
            <span>PINDO</span>
            <strong>{data.pindo.length}</strong>
            <small>Data terdaftar</small>
          </div>
        </div>

        <div className="monitor-stat-card monitor-dci">
          <div className="monitor-stat-icon">
            <Server size={22} />
          </div>

          <div className="monitor-stat-info">
            <span>DCI</span>
            <strong>{data.dci.length}</strong>
            <small>Data terdaftar</small>
          </div>
        </div>
      </section>

      {/* =====================================================
          SEARCH / FILTER
      ====================================================== */}

      <section className="monitor-control-card">
        <div className="monitor-search-box">
          <Search size={19} />

          <input
            type="text"
            placeholder="Cari nomor Tape Disk..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {search && (
            <button
              type="button"
              className="monitor-search-clear"
              onClick={() => setSearch("")}
            >
              ×
            </button>
          )}
        </div>

        <div className="monitor-filter">
          <button
            type="button"
            className={filter === "SEMUA" ? "active" : ""}
            onClick={() => setFilter("SEMUA")}
          >
            Semua
          </button>

          <button
            type="button"
            className={filter === "PINDO" ? "active" : ""}
            onClick={() => setFilter("PINDO")}
          >
            PINDO
          </button>

          <button
            type="button"
            className={filter === "DCI" ? "active" : ""}
            onClick={() => setFilter("DCI")}
          >
            DCI
          </button>
        </div>
      </section>

      {/* =====================================================
          DATA
      ====================================================== */}

      <section className="monitor-data-card">
        <div className="monitor-data-header">
          <div>
            <h2>Data Tape Disk</h2>

            <p>
              {loading
                ? "Mengambil data dari database..."
                : `${filteredTapes.length} data ditampilkan`}
            </p>
          </div>

          <div className="monitor-realtime">
            <RefreshCw size={16} className={loading ? "monitor-spin" : ""} />

            <span>Realtime</span>
          </div>
        </div>

        {/* =====================================================
            DESKTOP TABLE
        ====================================================== */}

        <div className="monitor-table-container">
          <table className="monitor-table">
            <thead>
              <tr>
                <th width="70">No</th>
                <th>Tape Disk</th>
                <th>Lokasi</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" className="monitor-table-empty">
                    <RefreshCw size={30} className="monitor-spin" />

                    <strong>Mengambil data...</strong>

                    <span>Menghubungkan ke database monitoring</span>
                  </td>
                </tr>
              ) : filteredTapes.length === 0 ? (
                <tr>
                  <td colSpan="4" className="monitor-table-empty">
                    <HardDrive size={32} />

                    <strong>Data tidak ditemukan</strong>

                    <span>Coba gunakan kata pencarian lain.</span>
                  </td>
                </tr>
              ) : (
                filteredTapes.map((tape, index) => {
                  const code =
                    tape.code ||
                    tape.tapedisk ||
                    tape.kode ||
                    tape.barcode ||
                    tape.serial ||
                    tape.id ||
                    "-";

                  const location = tape.location || "TIDAK_DITEMUKAN";

                  return (
                    <tr key={`${location}-${tape.id || code}-${index}`}>
                      <td>
                        <span className="monitor-number">{index + 1}</span>
                      </td>

                      <td>
                        <div className="monitor-tape-code">
                          <div className="monitor-tape-icon">
                            <HardDrive size={16} />
                          </div>

                          <strong>{code}</strong>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`monitor-location ${location.toLowerCase()}`}
                        >
                          <MapPin size={13} />
                          {location}
                        </span>
                      </td>

                      <td>
                        <span className="monitor-status">
                          <span></span>
                          Terdaftar
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* =====================================================
            MOBILE
        ====================================================== */}

        <div className="monitor-mobile-list">
          {loading ? (
            <div className="monitor-mobile-empty">
              <RefreshCw size={30} className="monitor-spin" />

              <strong>Mengambil data...</strong>
            </div>
          ) : filteredTapes.length === 0 ? (
            <div className="monitor-mobile-empty">
              <HardDrive size={32} />

              <strong>Data tidak ditemukan</strong>

              <span>Coba ubah pencarian.</span>
            </div>
          ) : (
            filteredTapes.map((tape, index) => {
              const code =
                tape.code ||
                tape.tapedisk ||
                tape.kode ||
                tape.barcode ||
                tape.serial ||
                tape.id ||
                "-";

              const location = tape.location || "TIDAK_DITEMUKAN";

              return (
                <div
                  className="monitor-mobile-item"
                  key={`mobile-${location}-${tape.id || code}-${index}`}
                >
                  <span className="monitor-mobile-number">{index + 1}</span>

                  <div className="monitor-mobile-content">
                    <strong>{code}</strong>

                    <div className="monitor-mobile-meta">
                      <span
                        className={`monitor-location ${location.toLowerCase()}`}
                      >
                        <MapPin size={12} />
                        {location}
                      </span>

                      <span className="monitor-status">
                        <span></span>
                        Terdaftar
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};

export default Monitor;
