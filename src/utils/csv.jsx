export const normalizeCode = (value) => {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
};

export const parseCSVLine = (line) => {
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

      continue;
    }

    if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());

  return result.map((value) => value.replace(/^"|"$/g, "").trim());
};

export const parseTapeCSV = (text) => {
  if (!text) {
    throw new Error("CSV kosong.");
  }

  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("CSV tidak mempunyai data.");
  }

  const firstRow = parseCSVLine(lines[0]);
  const firstValue = normalizeCode(firstRow[0]);

  const possibleHeaders = [
    "KODE",
    "CODE",
    "BARCODE",
    "SERIAL",
    "SERIALNUMBER",
    "TAPE",
    "TAPEID",
    "TAPECODE",
    "ID",
  ];

  const isHeader =
    possibleHeaders.includes(firstValue) ||
    firstValue.includes("KODE") ||
    firstValue.includes("CODE") ||
    firstValue.includes("BARCODE") ||
    firstValue.includes("SERIAL") ||
    firstValue.includes("TAPE");

  let startIndex = 0;
  let headers = ["kode"];
  let codeIndex = 0;

  if (isHeader) {
    headers = firstRow.map((header) => header.toLowerCase().trim());

    codeIndex = headers.findIndex(
      (header) =>
        header.includes("kode") ||
        header.includes("code") ||
        header.includes("barcode") ||
        header.includes("serial") ||
        header.includes("tape") ||
        header === "id",
    );

    if (codeIndex === -1) {
      codeIndex = 0;
    }

    startIndex = 1;
  }

  const parsedData = [];

  for (let i = startIndex; i < lines.length; i++) {
    const columns = parseCSVLine(lines[i]);
    const code = columns[codeIndex];

    if (!code) continue;

    const cleanCode = code.replace(/^"|"$/g, "").trim();

    if (!cleanCode) continue;

    parsedData.push({
      code: cleanCode,
      row: i + 1,
      data: columns,
      headers,
    });
  }

  if (parsedData.length === 0) {
    throw new Error("Tidak ada kode tape yang ditemukan.");
  }

  return parsedData;
};

export const findTapeInCSV = (csvData, scannedCode) => {
  const normalizedScanned = normalizeCode(scannedCode);

  if (!normalizedScanned || csvData.length === 0) {
    return null;
  }

  return (
    csvData.find((item) => normalizeCode(item.code) === normalizedScanned) ||
    null
  );
};
