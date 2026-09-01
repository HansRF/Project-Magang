import React from "react";
import { ScanLine } from "lucide-react";

function Header() {
  return (
    <header className="header">
      <div className="logo">
        <ScanLine size={25} />
      </div>

      <div>
        <h1>Tape Disk Scanner</h1>
        <p>Cari tape berdasarkan data CSV</p>
      </div>
    </header>
  );
}

export default Header;