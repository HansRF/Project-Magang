import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  LogIn,
  Eye,
  EyeOff,
  Database,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { auth } from "../firebase";
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError("Email dan password wajib diisi.");
      return;
    }
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password,
      );
      if (onLogin) {
        onLogin(result.user);
      }
    } catch (err) {
      console.error("Login error:", err);
      switch (err.code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          setError("Email atau password salah.");
          break;
        case "auth/invalid-email":
          setError("Format email tidak valid.");
          break;
        case "auth/user-disabled":
          setError("Akun ini telah dinonaktifkan.");
          break;
        case "auth/too-many-requests":
          setError("Terlalu banyak percobaan login. Coba lagi beberapa saat.");
          break;
        case "auth/network-request-failed":
          setError(
            "Koneksi internet bermasalah. Periksa koneksi lalu coba lagi.",
          );
          break;
        default:
          setError("Login gagal. Periksa koneksi dan konfigurasi Firebase.");
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="login-page">
      {" "}
      <section className="login-card">
        {" "}
        {/* LOGO */}{" "}
        <div className="login-logo">
          {" "}
          <Database size={32} />{" "}
        </div>{" "}
        {/* HEADER */}{" "}
        <div className="login-header">
          {" "}
          <h1>Tape Disk Scanner</h1>{" "}
          <p> Sistem pencarian dan monitoring Tape Disk </p>{" "}
        </div>{" "}
        {/* FORM */}{" "}
        <form onSubmit={handleSubmit}>
          {" "}
          {/* EMAIL */}{" "}
          <div className="login-field">
            {" "}
            <label htmlFor="login-email"> Email </label>{" "}
            <input
              id="login-email"
              type="email"
              placeholder="Masukkan email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              disabled={loading}
            />{" "}
          </div>{" "}
          {/* PASSWORD */}{" "}
          <div className="login-field">
            {" "}
            <label htmlFor="login-password"> Password </label>{" "}
            <div className="password-wrapper">
              {" "}
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Masukkan password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />{" "}
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((previous) => !previous)}
                disabled={loading}
                aria-label={
                  showPassword ? "Sembunyikan password" : "Tampilkan password"
                }
              >
                {" "}
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}{" "}
              </button>{" "}
            </div>{" "}
          </div>{" "}
          {/* ERROR */}{" "}
          {error && (
            <div className="login-error">
              {" "}
              <AlertCircle size={17} /> <span>{error}</span>{" "}
            </div>
          )}{" "}
          {/* LOGIN BUTTON */}{" "}
          <button type="submit" className="login-button" disabled={loading}>
            {" "}
            {loading ? (
              <>
                {" "}
                <span className="login-spinner" /> Memproses...{" "}
              </>
            ) : (
              <>
                {" "}
                <LogIn size={18} /> Masuk{" "}
              </>
            )}{" "}
          </button>{" "}
        </form>{" "}
        {/* SECURITY */}{" "}
        <div className="login-security">
          {" "}
          <ShieldCheck size={16} />{" "}
          <span> Login menggunakan Firebase Authentication </span>{" "}
        </div>{" "}
      </section>{" "}
    </main>
  );
}
export default Login;
