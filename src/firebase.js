import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBETPqyBdydbqkHv6Nlu_BnlPKj8Z2Ep60",
  authDomain: "tapedisk-drive.firebaseapp.com",
  projectId: "tapedisk-drive",
  storageBucket: "tapedisk-drive.firebasestorage.app",
  messagingSenderId: "1078724976232",
  appId: "1:1078724976232:web:f707aa27e167e4eb9ca5dd",
  measurementId: "G-2S31NJ46GM",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

setPersistence(auth, browserSessionPersistence).catch((error) => {
  console.error("Gagal mengatur session persistence:", error);
});

export const db = getFirestore(app);

export default app;
