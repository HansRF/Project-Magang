import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase";
import { normalizeCode } from "./csv";

export const PINDO_COLLECTION = "tapedisk_pindo";
export const DCI_COLLECTION = "tapedisk_dci";

// =========================================================
// AMBIL SEMUA DATA PINDO
// =========================================================

export const getPindoTapes = async () => {
  const snapshot = await getDocs(collection(db, PINDO_COLLECTION));

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
    location: "PINDO",
  }));
};

// =========================================================
// AMBIL SEMUA DATA DCI
// =========================================================

export const getDCITapes = async () => {
  const snapshot = await getDocs(collection(db, DCI_COLLECTION));

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
    location: "DCI",
  }));
};

// =========================================================
// CARI LOKASI SATU TAPE
// =========================================================

export const getTapeLocation = async (code) => {
  const normalized = normalizeCode(code);

  if (!normalized) {
    return {
      code: "",
      location: "TIDAK_DITEMUKAN",
    };
  }

  const pindoRef = doc(db, PINDO_COLLECTION, normalized);
  const dciRef = doc(db, DCI_COLLECTION, normalized);

  const [pindoSnapshot, dciSnapshot] = await Promise.all([
    getDoc(pindoRef),
    getDoc(dciRef),
  ]);

  if (pindoSnapshot.exists()) {
    return {
      code: normalized,
      location: "PINDO",
      data: pindoSnapshot.data(),
    };
  }

  if (dciSnapshot.exists()) {
    return {
      code: normalized,
      location: "DCI",
      data: dciSnapshot.data(),
    };
  }

  return {
    code: normalized,
    location: "TIDAK_DITEMUKAN",
  };
};

// =========================================================
// REALTIME MONITORING
// =========================================================

export const subscribeTapeMonitoring = (callback) => {
  let pindo = [];
  let dci = [];

  const update = () => {
    callback({
      pindo,
      dci,
      total: pindo.length + dci.length,
    });
  };

  const unsubscribePindo = onSnapshot(
    collection(db, PINDO_COLLECTION),
    (snapshot) => {
      pindo = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
        location: "PINDO",
      }));

      update();
    },
    (error) => {
      console.error("Firebase PINDO error:", error);
    },
  );

  const unsubscribeDCI = onSnapshot(
    collection(db, DCI_COLLECTION),
    (snapshot) => {
      dci = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
        location: "DCI",
      }));

      update();
    },
    (error) => {
      console.error("Firebase DCI error:", error);
    },
  );

  return () => {
    unsubscribePindo();
    unsubscribeDCI();
  };
};

// =========================================================
// VALIDASI TAPE DARI FILE
// =========================================================

export const validateTapesBeforeScan = async (tapeList) => {
  if (!Array.isArray(tapeList)) {
    throw new Error("Data Tape Disk harus berupa array.");
  }

  const [pindoSnapshot, dciSnapshot] = await Promise.all([
    getDocs(collection(db, PINDO_COLLECTION)),
    getDocs(collection(db, DCI_COLLECTION)),
  ]);

  const pindoSet = new Set(
    pindoSnapshot.docs.map((item) => normalizeCode(item.id)),
  );

  const dciSet = new Set(
    dciSnapshot.docs.map((item) => normalizeCode(item.id)),
  );

  return tapeList.map((item) => {
    const code = normalizeCode(
      typeof item === "string"
        ? item
        : item?.kode ||
            item?.code ||
            item?.barcode ||
            item?.serial ||
            item?.tape ||
            item?.tapedisk ||
            item?.id ||
            "",
    );

    let location = "TIDAK_DITEMUKAN";

    if (pindoSet.has(code)) {
      location = "PINDO";
    } else if (dciSet.has(code)) {
      location = "DCI";
    }

    return {
      code,
      location,
    };
  });
};

// =========================================================
// PINDAHKAN SATU TAPE: PINDO -> DCI
// =========================================================

export const moveTapeToDCI = async (code, extraData = {}) => {
  const normalized = normalizeCode(code);

  if (!normalized) {
    throw new Error("Kode Tape Disk kosong.");
  }

  const pindoRef = doc(db, PINDO_COLLECTION, normalized);
  const dciRef = doc(db, DCI_COLLECTION, normalized);

  const pindoSnapshot = await getDoc(pindoRef);

  if (!pindoSnapshot.exists()) {
    throw new Error(`Tape ${normalized} tidak ditemukan di database PINDO.`);
  }

  const batch = writeBatch(db);

  batch.set(dciRef, {
    ...pindoSnapshot.data(),
    ...extraData,
    code: normalized,
    location: "DCI",
    movedAt: serverTimestamp(),
  });

  batch.delete(pindoRef);

  await batch.commit();

  return {
    success: true,
    code: normalized,
    from: "PINDO",
    to: "DCI",
  };
};

// =========================================================
// PINDAHKAN SATU TAPE: DCI -> PINDO
// =========================================================

export const moveTapeToPindo = async (code, extraData = {}) => {
  const normalized = normalizeCode(code);

  if (!normalized) {
    throw new Error("Kode Tape Disk kosong.");
  }

  const dciRef = doc(db, DCI_COLLECTION, normalized);
  const pindoRef = doc(db, PINDO_COLLECTION, normalized);

  const dciSnapshot = await getDoc(dciRef);

  if (!dciSnapshot.exists()) {
    throw new Error(`Tape ${normalized} tidak ditemukan di database DCI.`);
  }

  const batch = writeBatch(db);

  batch.set(pindoRef, {
    ...dciSnapshot.data(),
    ...extraData,
    code: normalized,
    location: "PINDO",
    movedAt: serverTimestamp(),
  });

  batch.delete(dciRef);

  await batch.commit();

  return {
    success: true,
    code: normalized,
    from: "DCI",
    to: "PINDO",
  };
};

// =========================================================
// PINDAHKAN BANYAK TAPE KE TUJUAN
// =========================================================

export const moveTapesToDestination = async (tapes, destination) => {
  if (!Array.isArray(tapes) || tapes.length === 0) {
    throw new Error("Tidak ada Tape Disk yang akan dipindahkan.");
  }

  if (destination !== "PINDO" && destination !== "DCI") {
    throw new Error("Tujuan Tape Disk tidak valid.");
  }

  const sourceCollection =
    destination === "DCI" ? PINDO_COLLECTION : DCI_COLLECTION;

  const targetCollection =
    destination === "DCI" ? DCI_COLLECTION : PINDO_COLLECTION;

  // =======================================================
  // BERSIHKAN DAN HILANGKAN DUPLIKAT KODE
  // =======================================================

  const codes = [
    ...new Set(
      tapes
        .map((item) => {
          if (typeof item === "string") {
            return normalizeCode(item);
          }

          return normalizeCode(
            item?.code ||
              item?.kode ||
              item?.barcode ||
              item?.serial ||
              item?.tape ||
              item?.tapedisk ||
              item?.id ||
              "",
          );
        })
        .filter(Boolean),
    ),
  ];

  if (codes.length === 0) {
    throw new Error("Tidak ada kode Tape Disk yang valid.");
  }

  // =======================================================
  // CEK ULANG SOURCE DATABASE
  // =======================================================

  const sourceSnapshots = await Promise.all(
    codes.map((code) => getDoc(doc(db, sourceCollection, code))),
  );

  const missingCodes = [];

  sourceSnapshots.forEach((snapshot, index) => {
    if (!snapshot.exists()) {
      missingCodes.push(codes[index]);
    }
  });

  if (missingCodes.length > 0) {
    throw new Error(
      `Tape berikut tidak ditemukan lagi di database ${sourceCollection === PINDO_COLLECTION ? "PINDO" : "DCI"}: ${missingCodes.join(", ")}`,
    );
  }

  // =======================================================
  // CEK DUPLIKAT DI TARGET
  // =======================================================

  const targetSnapshots = await Promise.all(
    codes.map((code) => getDoc(doc(db, targetCollection, code))),
  );

  const alreadyExistsInTarget = [];

  targetSnapshots.forEach((snapshot, index) => {
    if (snapshot.exists()) {
      alreadyExistsInTarget.push(codes[index]);
    }
  });

  if (alreadyExistsInTarget.length > 0) {
    throw new Error(
      `Tape berikut sudah ada di database tujuan: ${alreadyExistsInTarget.join(", ")}`,
    );
  }

  // =======================================================
  // BATASI BATCH FIRESTORE
  // =======================================================
  // Firestore memiliki batas maksimal 500 operasi dalam satu
  // batch. Setiap tape membutuhkan 2 operasi:
  // 1 SET ke tujuan
  // 1 DELETE dari source
  //
  // Jadi maksimal aman 250 tape per batch.
  // =======================================================

  const BATCH_SIZE = 250;

  for (let start = 0; start < codes.length; start += BATCH_SIZE) {
    const batchCodes = codes.slice(start, start + BATCH_SIZE);

    const batch = writeBatch(db);

    batchCodes.forEach((code) => {
      const sourceRef = doc(db, sourceCollection, code);
      const targetRef = doc(db, targetCollection, code);

      const sourceData = sourceSnapshots[codes.indexOf(code)].data() || {};

      batch.set(targetRef, {
        ...sourceData,
        code,
        location: destination,
        movedAt: serverTimestamp(),
      });

      batch.delete(sourceRef);
    });

    await batch.commit();
  }

  return {
    success: true,
    total: codes.length,
    destination,
    source: destination === "DCI" ? "PINDO" : "DCI",
  };
};

// =========================================================
// TAMBAHKAN TAPE KE PINDO
// =========================================================

export const addTapeToPindo = async (code) => {
  const normalized = normalizeCode(code);

  if (!normalized) {
    return;
  }

  await setDoc(doc(db, PINDO_COLLECTION, normalized), {
    code: normalized,
    location: "PINDO",
    createdAt: serverTimestamp(),
  });
};

// =========================================================
// TAMBAHKAN TAPE KE DCI
// =========================================================

export const addTapeToDCI = async (code) => {
  const normalized = normalizeCode(code);

  if (!normalized) {
    return;
  }

  await setDoc(doc(db, DCI_COLLECTION, normalized), {
    code: normalized,
    location: "DCI",
    createdAt: serverTimestamp(),
  });
};

// =========================================================
// HAPUS TAPE
// =========================================================

export const deleteTape = async (location, code) => {
  const normalized = normalizeCode(code);

  if (!normalized) {
    throw new Error("Kode Tape Disk kosong.");
  }

  const collectionName = location === "DCI" ? DCI_COLLECTION : PINDO_COLLECTION;

  const tapeRef = doc(db, collectionName, normalized);

  await deleteDoc(tapeRef);

  return {
    success: true,
    code: normalized,
    location,
  };
};
