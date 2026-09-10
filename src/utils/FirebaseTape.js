import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  deleteDoc,
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
    import("firebase/firestore").then(({ getDoc }) => getDoc(pindoRef)),
    import("firebase/firestore").then(({ getDoc }) => getDoc(dciRef)),
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
        : item.kode ||
            item.code ||
            item.barcode ||
            item.serial ||
            item.tape ||
            item.id ||
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
// PINDAHKAN PINDO -> DCI
// =========================================================

export const moveTapeToDCI = async (code, extraData = {}) => {
  const normalized = normalizeCode(code);

  if (!normalized) {
    throw new Error("Kode Tape Disk kosong.");
  }

  const pindoRef = doc(db, PINDO_COLLECTION, normalized);
  const dciRef = doc(db, DCI_COLLECTION, normalized);

  const batch = writeBatch(db);

  batch.set(dciRef, {
    code: normalized,
    location: "DCI",
    movedAt: serverTimestamp(),
    ...extraData,
  });

  batch.delete(pindoRef);

  await batch.commit();
};

// =========================================================
// PINDAHKAN DCI -> PINDO
// =========================================================

export const moveTapeToPindo = async (code, extraData = {}) => {
  const normalized = normalizeCode(code);

  if (!normalized) {
    throw new Error("Kode Tape Disk kosong.");
  }

  const dciRef = doc(db, DCI_COLLECTION, normalized);
  const pindoRef = doc(db, PINDO_COLLECTION, normalized);

  const batch = writeBatch(db);

  batch.set(pindoRef, {
    code: normalized,
    location: "PINDO",
    movedAt: serverTimestamp(),
    ...extraData,
  });

  batch.delete(dciRef);

  await batch.commit();
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

  const collectionName = location === "DCI" ? DCI_COLLECTION : PINDO_COLLECTION;

  await deleteDoc(doc(db, collectionName, normalized));
};
