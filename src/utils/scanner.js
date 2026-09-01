import { BrowserMultiFormatReader } from "@zxing/browser";

export const createScanner = () => {
  return new BrowserMultiFormatReader();
};

export const getBarcodeText = (result) => {
  return result?.getText()?.trim() || "";
};

export const getBarcodeFormat = (result) => {
  return (
    result?.getBarcodeFormat()?.toString?.() ||
    "UNKNOWN"
  );
};

export const scanImageFile = async (file) => {
  const url = URL.createObjectURL(file);

  try {
    const img = new Image();

    const result = await new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error("File gambar tidak dapat dibaca."));

      img.src = url;
    });

    const reader = new BrowserMultiFormatReader();

    return await reader.decodeFromImageElement(result);
  } finally {
    URL.revokeObjectURL(url);
  }
};