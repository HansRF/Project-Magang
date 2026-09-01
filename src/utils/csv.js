export const normalizeCode = (value) => {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
};

const getCodeFromRow = (row) => {
  const keys = Object.keys(row);

  // Cari kolom berdasarkan nama header
  const codeKey = keys.find((key) => {
    const normalizedKey = String(key).trim().toLowerCase().replace(/\s+/g, "");

    return (
      normalizedKey.includes("kode") ||
      normalizedKey.includes("code") ||
      normalizedKey.includes("barcode") ||
      normalizedKey.includes("serial") ||
      normalizedKey.includes("tape") ||
      normalizedKey === "id"
    );
  });

  // Kalau ketemu kolom kode
  if (codeKey) {
    return row[codeKey];
  }

  // Kalau tidak ketemu, gunakan kolom pertama
  return row[keys[0]];
};

/**
 * Parse CSV
 */
export const parseTapeCSV = (text) => {
  if (!text || !text.trim()) {
    throw new Error("CSV kosong.");
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV tidak memiliki data.");
  }

  const parseCSVLine = (line) => {
    const result = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());

    return result;
  };

  const headers = parseCSVLine(lines[0]).map((header) =>
    header.replace(/^"|"$/g, "").trim(),
  );

  const data = lines.slice(1).map((line) => {
    const values = parseCSVLine(line);

    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    const code = getCodeFromRow(row);

    return {
      ...row,
      code: String(code || "").trim(),
    };
  });

  return data.filter((item) => item.code);
};

/**
 * Cari tape berdasarkan barcode/kode
 */
export const findTapeInCSV = (data, scannedCode) => {
  if (!Array.isArray(data) || !scannedCode) {
    return null;
  }

  const normalizedScannedCode = normalizeCode(scannedCode);

  return (
    data.find((item) => normalizeCode(item.code) === normalizedScannedCode) ||
    null
  );
};

/**
 * Parse XLSX / XLS
 */
export const parseTapeXLSX = async (file) => {
  const XLSX = await import("xlsx");

  const arrayBuffer = await file.arrayBuffer();

  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: true,
  });

  if (!workbook.SheetNames.length) {
    throw new Error("File Excel tidak memiliki sheet.");
  }

  // Ambil sheet pertama
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
  });

  if (!rows.length) {
    throw new Error("File Excel kosong.");
  }

  const parsedData = rows
    .map((row) => {
      const code = getCodeFromRow(row);

      return {
        ...row,
        code: String(code || "").trim(),
      };
    })
    .filter((item) => item.code);

  if (!parsedData.length) {
    throw new Error("Tidak ditemukan kolom kode/barcode pada file Excel.");
  }

  return parsedData;
};

/**
 * Parse file CSV / XLSX / XLS
 */
export const parseTapeFile = async (file) => {
  if (!file) {
    throw new Error("File tidak ditemukan.");
  }

  const extension = file.name.split(".").pop().toLowerCase();

  // CSV
  if (extension === "csv") {
    const text = await file.text();
    return parseTapeCSV(text);
  }

  // Excel
  if (extension === "xlsx" || extension === "xls") {
    return await parseTapeXLSX(file);
  }

  throw new Error("Format file tidak didukung. Gunakan CSV, XLSX, atau XLS.");
};
