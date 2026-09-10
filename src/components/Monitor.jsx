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
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  AlertTriangle,
  ArrowRightLeft,
} from "lucide-react";

import {
  subscribeTapeMonitoring,
  addTapeToPindo,
  addTapeToDCI,
  moveTapeToPindo,
  moveTapeToDCI,
  deleteTape,
} from "../utils/FirebaseTape";

const Monitor = ({ onBack }) => {
  // =========================================================
  // DATA FIRESTORE
  // =========================================================

  const [data, setData] = useState({
    pindo: [],
    dci: [],
    total: 0,
  });

  const [loading, setLoading] = useState(true);

  // =========================================================
  // SEARCH / FILTER
  // =========================================================

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("SEMUA");

  // =========================================================
  // MODAL
  // =========================================================

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("add");

  // =========================================================
  // FORM
  // =========================================================

  const [formCode, setFormCode] = useState("");
  const [formLocation, setFormLocation] = useState("PINDO");

  // Data yang sedang diedit
  const [selectedTape, setSelectedTape] = useState(null);

  // =========================================================
  // PROCESS
  // =========================================================

  const [saving, setSaving] = useState(false);

  // =========================================================
  // ERROR / SUCCESS
  // =========================================================

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
  // BUKA MODAL TAMBAH
  // =========================================================

  const openAddModal = () => {
    setModalType("add");
    setSelectedTape(null);
    setFormCode("");
    setFormLocation("PINDO");
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  // =========================================================
  // BUKA MODAL EDIT
  // =========================================================

  const openEditModal = (tape) => {
    const code =
      tape.code ||
      tape.tapedisk ||
      tape.kode ||
      tape.barcode ||
      tape.serial ||
      tape.id ||
      "";

    setModalType("edit");
    setSelectedTape(tape);
    setFormCode(code);
    setFormLocation(tape.location || "PINDO");
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  // =========================================================
  // TUTUP MODAL
  // =========================================================

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setSelectedTape(null);
    setFormCode("");
    setFormLocation("PINDO");
    setError("");
  };

  // =========================================================
  // CEK APAKAH KODE SUDAH ADA
  // =========================================================

  const isCodeAlreadyExists = (code, ignoreCode = "") => {
    const normalizedCode = code.trim().toUpperCase();
    const normalizedIgnore = ignoreCode.trim().toUpperCase();

    return allTapes.some((tape) => {
      const tapeCode = String(
        tape.code ||
          tape.tapedisk ||
          tape.kode ||
          tape.barcode ||
          tape.serial ||
          tape.id ||
          "",
      )
        .trim()
        .toUpperCase();

      return tapeCode === normalizedCode && tapeCode !== normalizedIgnore;
    });
  };

  // =========================================================
  // SIMPAN DATA
  // =========================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    const code = formCode.trim().toUpperCase();

    if (!code) {
      setError("Nomor Tape Disk wajib diisi.");
      return;
    }

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      // =====================================================
      // CREATE
      // =====================================================

      if (modalType === "add") {
        if (isCodeAlreadyExists(code)) {
          setError(`Tape Disk ${code} sudah terdaftar di database.`);
          setSaving(false);
          return;
        }

        if (formLocation === "PINDO") {
          await addTapeToPindo(code);
        } else {
          await addTapeToDCI(code);
        }

        setSuccess(
          `Tape Disk ${code} berhasil ditambahkan ke ${formLocation}.`,
        );

        setTimeout(() => {
          setModalOpen(false);
          setSuccess("");
          setFormCode("");
        }, 700);

        return;
      }

      // =====================================================
      // UPDATE
      // =====================================================

      const oldCode = String(
        selectedTape?.code ||
          selectedTape?.tapedisk ||
          selectedTape?.kode ||
          selectedTape?.barcode ||
          selectedTape?.serial ||
          selectedTape?.id ||
          "",
      )
        .trim()
        .toUpperCase();

      const oldLocation = selectedTape?.location || "PINDO";

      // Kalau nomor Tape Disk berubah
      if (code !== oldCode) {
        if (isCodeAlreadyExists(code, oldCode)) {
          setError(`Tape Disk ${code} sudah terdaftar di database.`);
          setSaving(false);
          return;
        }

        // Buat data baru sesuai lokasi
        if (formLocation === "PINDO") {
          await addTapeToPindo(code);
        } else {
          await addTapeToDCI(code);
        }

        // Hapus kode lama
        await deleteTape(oldLocation, oldCode);
      }

      // =====================================================
      // UPDATE LOKASI
      // =====================================================
      else if (formLocation !== oldLocation) {
        if (formLocation === "PINDO") {
          await moveTapeToPindo(oldCode);
        } else {
          await moveTapeToDCI(oldCode);
        }
      }

      // =====================================================
      // SELESAI
      // =====================================================

      setSuccess(`Tape Disk ${code} berhasil diperbarui.`);

      setTimeout(() => {
        setModalOpen(false);
        setSuccess("");
        setSelectedTape(null);
      }, 700);
    } catch (err) {
      console.error("CRUD Tape Disk error:", err);

      setError(err?.message || "Gagal menyimpan data Tape Disk.");
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // DELETE
  // =========================================================

  const handleDelete = async (tape) => {
    const code =
      tape.code ||
      tape.tapedisk ||
      tape.kode ||
      tape.barcode ||
      tape.serial ||
      tape.id ||
      "";

    const location = tape.location || "PINDO";

    const confirmed = window.confirm(
      `Yakin ingin menghapus Tape Disk ${code} dari ${location}?\n\nData yang sudah dihapus tidak dapat dikembalikan.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      await deleteTape(location, code);

      setSuccess(`Tape Disk ${code} berhasil dihapus.`);

      setTimeout(() => {
        setSuccess("");
      }, 2500);
    } catch (err) {
      console.error("Delete Tape Disk error:", err);

      setError(err?.message || "Gagal menghapus Tape Disk.");

      setTimeout(() => {
        setError("");
      }, 3000);
    }
  };

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
            <p>Monitoring dan pengelolaan data Tape Disk</p>
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
          NOTIFICATION
      ====================================================== */}

      {error && (
        <div className="monitor-notification monitor-notification-error">
          <AlertTriangle size={18} />

          <span>{error}</span>

          <button type="button" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="monitor-notification monitor-notification-success">
          <Save size={18} />

          <span>{success}</span>

          <button type="button" onClick={() => setSuccess("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* =====================================================
          STATISTICS
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
          CONTROL
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

        <div className="monitor-control-actions">
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

          <button
            type="button"
            className="monitor-add-button"
            onClick={openAddModal}
          >
            <Plus size={17} />
            Tambah Tape
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
                <th width="65">No</th>
                <th>Tape Disk</th>
                <th>Lokasi</th>
                <th>Status</th>
                <th width="150">Aksi</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="monitor-table-empty">
                    <RefreshCw size={30} className="monitor-spin" />

                    <strong>Mengambil data...</strong>

                    <span>Menghubungkan ke database monitoring</span>
                  </td>
                </tr>
              ) : filteredTapes.length === 0 ? (
                <tr>
                  <td colSpan="5" className="monitor-table-empty">
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

                      <td>
                        <div className="monitor-action-buttons">
                          <button
                            type="button"
                            className="monitor-edit-button"
                            onClick={() => openEditModal(tape)}
                            title="Edit Tape Disk"
                          >
                            <Pencil size={15} />
                            Edit
                          </button>

                          <button
                            type="button"
                            className="monitor-delete-button"
                            onClick={() => handleDelete(tape)}
                            title="Hapus Tape Disk"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
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

                    <div className="monitor-mobile-actions">
                      <button
                        type="button"
                        className="monitor-edit-button"
                        onClick={() => openEditModal(tape)}
                      >
                        <Pencil size={14} />
                        Edit
                      </button>

                      <button
                        type="button"
                        className="monitor-delete-button"
                        onClick={() => handleDelete(tape)}
                      >
                        <Trash2 size={14} />
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* =====================================================
          MODAL CREATE / UPDATE
      ====================================================== */}

      {modalOpen && (
        <div className="monitor-modal-overlay">
          <section className="monitor-modal">
            <div className="monitor-modal-header">
              <div className="monitor-modal-title">
                <div className="monitor-modal-icon">
                  {modalType === "add" ? (
                    <Plus size={21} />
                  ) : (
                    <Pencil size={21} />
                  )}
                </div>

                <div>
                  <h2>
                    {modalType === "add"
                      ? "Tambah Tape Disk"
                      : "Edit Tape Disk"}
                  </h2>

                  <p>
                    {modalType === "add"
                      ? "Tambahkan data Tape Disk baru"
                      : "Ubah data Tape Disk"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="monitor-modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                <X size={19} />
              </button>
            </div>

            <form className="monitor-form" onSubmit={handleSubmit}>
              {/* KODE */}

              <div className="monitor-form-group">
                <label>Nomor Tape Disk</label>

                <div className="monitor-input-wrapper">
                  <HardDrive size={17} />

                  <input
                    type="text"
                    placeholder="Contoh: SY1888L8"
                    value={formCode}
                    onChange={(event) =>
                      setFormCode(event.target.value.toUpperCase())
                    }
                    disabled={saving}
                    autoFocus
                  />
                </div>
              </div>

              {/* LOKASI */}

              <div className="monitor-form-group">
                <label>Lokasi</label>

                <div className="monitor-location-options">
                  <button
                    type="button"
                    className={
                      formLocation === "PINDO"
                        ? "monitor-location-option active pindo"
                        : "monitor-location-option pindo"
                    }
                    onClick={() => setFormLocation("PINDO")}
                    disabled={saving}
                  >
                    <MapPin size={18} />

                    <span>
                      <strong>PINDO</strong>
                      <small>Lokasi PINDO</small>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={
                      formLocation === "DCI"
                        ? "monitor-location-option active dci"
                        : "monitor-location-option dci"
                    }
                    onClick={() => setFormLocation("DCI")}
                    disabled={saving}
                  >
                    <Server size={18} />

                    <span>
                      <strong>DCI</strong>
                      <small>Lokasi DCI</small>
                    </span>
                  </button>
                </div>
              </div>

              {/* INFO PINDAH */}

              {modalType === "edit" &&
                selectedTape &&
                formLocation !== selectedTape.location && (
                  <div className="monitor-move-info">
                    <ArrowRightLeft size={18} />

                    <div>
                      <strong>Lokasi akan dipindahkan</strong>

                      <span>
                        {selectedTape.location} → {formLocation}
                      </span>
                    </div>
                  </div>
                )}

              {/* ERROR */}

              {error && (
                <div className="monitor-form-error">
                  <AlertTriangle size={16} />

                  <span>{error}</span>
                </div>
              )}

              {/* SUCCESS */}

              {success && (
                <div className="monitor-form-success">
                  <Save size={16} />

                  <span>{success}</span>
                </div>
              )}

              {/* ACTION */}

              <div className="monitor-modal-actions">
                <button
                  type="button"
                  className="monitor-cancel-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Batal
                </button>

                <button
                  type="submit"
                  className="monitor-save-button"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={16} className="monitor-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {modalType === "add" ? "Tambah Data" : "Simpan Perubahan"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

export default Monitor;
