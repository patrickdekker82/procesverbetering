// Readers for Excel and Word, shared by the app and the tests (both libraries run in browser and Node).
import mammoth from 'mammoth';
import { readSheet } from 'read-excel-file/universal';

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function readXlsx(bytes: Uint8Array): Promise<unknown[][]> {
  return readSheet(toArrayBuffer(bytes));
}

export async function readDocx(bytes: Uint8Array): Promise<string> {
  const data = toArrayBuffer(bytes);
  // mammoth's browser build reads `arrayBuffer`, its Node build reads `buffer`.
  const result = await mammoth.extractRawText({ arrayBuffer: data, buffer: new Uint8Array(data) });
  return result.value;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}
