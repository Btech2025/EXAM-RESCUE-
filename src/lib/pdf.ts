import * as pdfjs from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";


// Configure worker with local Vite asset URL and reliable CDN fallback
try {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
} catch (e) {
  console.warn("[PDF.js] Failed to set local workerSrc, falling back to CDN worker", e);
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version || "6.4.299"}/build/pdf.worker.min.mjs`;
}

/**
 * Validates a file and extracts raw text from a PDF document in the browser.
 * First uses PDF.js text layer; if scanned/no text, automatically runs Tesseract.js OCR.
 * Handles layout-aware line grouping, password protection, and corrupted files.
 */
export async function readPdf(file: File, onProgress?: (status: string) => void): Promise<string> {
  if (!file) {
    throw new Error("No file provided. Please select a syllabus PDF file.");
  }

  // 1. Validate file extension and MIME type
  const isPdfExtension = file.name.toLowerCase().endsWith(".pdf");
  const isPdfMime =
    file.type === "application/pdf" || file.type === "application/x-pdf" || file.type === ""; // Some OS/browsers leave MIME blank

  if (!isPdfExtension && !isPdfMime) {
    throw new Error(`"${file.name}" is not a PDF file. Please upload a document ending with .pdf.`);
  }

  // 2. Validate file size
  if (file.size === 0) {
    throw new Error(
      "The selected PDF is empty (0 bytes). Please upload a valid syllabus document.",
    );
  }

  const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(
      `This PDF exceeds the 25 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB). Please compress it or enter syllabus topics manually.`,
    );
  }

  // 3. Read array buffer and check PDF magic bytes (%PDF-)
  let arrayBuffer: ArrayBuffer;
  if (typeof file.arrayBuffer === "function") {
    arrayBuffer = await file.arrayBuffer();
  } else {
    arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error("Failed to read file contents into buffer."));
      reader.readAsArrayBuffer(file);
    });
  }

  const headerBytes = new Uint8Array(arrayBuffer.slice(0, 1024));
  const headerString = new TextDecoder("ascii", { fatal: false }).decode(headerBytes);

  if (!headerString.includes("%PDF-")) {
    throw new Error(
      "The selected file is not a valid PDF document (missing standard %PDF header). The file may be corrupted or renamed.",
    );
  }

  // 4. Open document with PDF.js
  let loadingTask: pdfjs.PDFDocumentLoadingTask | null = null;
  let doc: pdfjs.PDFDocumentProxy | null = null;

  try {
    try {
      loadingTask = pdfjs.getDocument({
        data: new Uint8Array(arrayBuffer),
        cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version || "6.4.299"}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version || "6.4.299"}/standard_fonts/`,
      });
      doc = await loadingTask.promise;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const errName = (err as { name?: string })?.name || "";

      console.error("[PDF Parser Error] Failed to open document:", { name: errName, message: msg });

      if (/password/i.test(msg) || errName === "PasswordException") {
        throw new Error(
          "This PDF is password-protected. Please remove the password and upload again, or enter your syllabus topics manually.",
        );
      }
      if (/invalid|corrupt|format/i.test(msg) || errName === "InvalidPDFException") {
        throw new Error(
          "The PDF file appears corrupted or improperly formatted. Please verify that the file opens in a PDF reader, or enter your syllabus manually.",
        );
      }
      throw new Error(
        `Could not open PDF file: ${msg}. Please try another file or enter syllabus topics manually.`,
      );
    }

    // 5. Extract text page by page with spatial line reconstruction
    if (doc.numPages === 0) {
      throw new Error("This PDF document contains 0 pages.");
    }

    const pages: string[] = [];
    let totalChars = 0;

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      let lastY: number | null = null;
      let pageText = "";

      for (const item of textContent.items) {
        if (!("str" in item)) continue;
        const str = item.str;
        if (!str) continue;

        const itemY = item.transform?.[5];

        // If vertical position shifted significantly, start a new line
        if (lastY !== null && itemY !== undefined && Math.abs(itemY - lastY) > 5) {
          if (!pageText.endsWith("\n")) pageText += "\n";
        } else if (pageText && !pageText.endsWith(" ") && !pageText.endsWith("\n") && str.trim()) {
          pageText += " ";
        }

        pageText += str;

        if (item.hasEOL && !pageText.endsWith("\n")) {
          pageText += "\n";
        }

        if (itemY !== undefined) {
          lastY = itemY;
        }
      }

      // Clean up page resources
      try {
        page.cleanup();
      } catch {
        // Safe to ignore if unsupported
      }

      const trimmedPage = pageText.trim();
      if (trimmedPage) {
        pages.push(trimmedPage);
        totalChars += trimmedPage.length;
      }
    }

    console.log(
      `[PDF Parser] Successfully extracted ${pages.length} pages (${totalChars} characters) from "${file.name}"`,
    );

    // 6. Scanned / image-based PDF handling: Automatically run OCR via Tesseract.js
    if (totalChars < 25) {
      console.log(
        `[PDF Parser] PDF contains no text layer (${totalChars} chars). Attempting automatic OCR via Tesseract.js across ${doc.numPages} pages...`,
      );

      if (typeof document === "undefined" || !document.createElement) {
        throw new Error(
          "No readable text found in this scanned PDF. OCR is available in the browser, or you can paste syllabus text manually.",
        );
      }

      onProgress?.(
        `Scanned document detected. Running automatic OCR scan on page 1 of ${doc.numPages}...`,
      );
      const { default: Tesseract } = await import("tesseract.js");
      const ocrPages: string[] = [];

      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        onProgress?.(`Running OCR on page ${pageNum} of ${doc.numPages}...`);

        let page: pdfjs.PDFPageProxy | null = null;
        try {
          page = await doc.getPage(pageNum);
          // Scale 2.0 provides ~200 DPI resolution, ideal for Tesseract character recognition
          const viewport = page.getViewport({ scale: 2.0 });

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            throw new Error("Unable to create canvas context for OCR rendering.");
          }

          await page.render({ canvasContext: ctx, viewport }).promise;

          // Apply adaptive contrast & binarization to clean up scan noise
          preprocessCanvasForOcr(canvas);

          const result = await Tesseract.recognize(canvas, "eng", {
            logger: (m) => {
              if (m.status === "recognizing text" && onProgress) {
                const pct = Math.round((m.progress || 0) * 100);
                onProgress(`OCR scanning page ${pageNum}/${doc.numPages} (${pct}%)...`);
              }
            },
          });

          // Free canvas memory immediately
          canvas.width = 0;
          canvas.height = 0;

          const rawPageText = (result?.data?.text || "").trim();
          if (rawPageText) {
            ocrPages.push(normalizeOcrSyllabusText(rawPageText));
          }
        } catch (pageOcrErr: unknown) {
          console.warn(`[PDF OCR] Error running OCR on page ${pageNum}:`, pageOcrErr);
        } finally {
          if (page) {
            try {
              page.cleanup();
            } catch {
              // Ignore page cleanup error
            }
          }
        }
      }

      const combinedOcrText = ocrPages.join("\n\n").trim();
      console.log(
        `[PDF Parser] OCR completed. Extracted ${combinedOcrText.length} characters across ${ocrPages.length} scanned pages.`,
      );

      if (combinedOcrText.length < 25) {
        throw new Error(
          "OCR scan could not detect readable syllabus text from this image-only document. Please ensure the scan is clear, or paste your syllabus text manually below.",
        );
      }

      return combinedOcrText;
    }

    return pages.join("\n\n");
  } finally {
    // 7. Proper PDF.js cleanup lifecycle:
    // Release document page/font caches
    if (doc) {
      try {
        await doc.cleanup();
      } catch (cleanupErr) {
        console.warn("[PDF Cleanup] doc.cleanup error:", cleanupErr);
      }
    }

    // Terminate worker transport and loading task
    if (loadingTask) {
      try {
        await loadingTask.destroy();
      } catch (destroyErr) {
        console.warn("[PDF Cleanup] loadingTask.destroy error:", destroyErr);
      }
    }
  }
}

/**
 * Enhances scanned page canvas for OCR by converting to grayscale and increasing text contrast.
 */
function preprocessCanvasForOcr(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  try {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i]!;
      const g = d[i + 1]!;
      const b = d[i + 2]!;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      // High-contrast clean thresholding for scanned document text
      const val =
        gray > 165 ? 255 : gray < 95 ? 0 : Math.min(255, Math.max(0, (gray - 95) * (255 / 70)));
      d[i] = val;
      d[i + 1] = val;
      d[i + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (err) {
    console.warn("[OCR Preprocess] Skipped canvas preprocessing:", err);
  }
}

/**
 * Normalizes common optical character recognition artifacts in syllabus documents
 * strictly when supported by structural context. Never guesses missing text or invents topics.
 */
export function normalizeOcrSyllabusText(text: string): string {
  return (
    text
      // Fix zero/O confusion in Course Outcomes (e.g. C01 -> CO1, C02 -> CO2)
      .replace(/\bC0([1-9])\b/g, "CO$1")
      // Fix digit 1 for letter I in UNIT (e.g. UN1T -> UNIT, UNlT -> UNIT)
      .replace(/\bUN[1lI]T\b/gi, "UNIT")
      // Fix digit 1 for letter L in MODULE (e.g. MODU1E -> MODULE)
      .replace(/\bMODU[1lI]E\b/gi, "MODULE")
      // Fix letter l for digit 1 in normal forms (e.g. lNF -> 1NF)
      .replace(/\blNF\b/g, "1NF")
      // Clean weird scanner borders/artifacts at start of lines
      .replace(/^[|\][}I!]\s*(UNIT|MODULE|CHAPTER|COURSE OUTCOME)/gim, "$1")
  );
}

function decodeXmlEntities(xml: string): string {
  return xml
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function extractTextFromWordXml(xml: string): string {
  const withBreaks = xml
    .replace(/<\/w:p>\s*<\/w:tc>/gi, "  ")
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<\/w:tr>/gi, "\n")
    .replace(/<w:br\b[^>]*\/?>/gi, "\n")
    .replace(/<w:cr\b[^>]*\/?>/gi, "\n")
    .replace(/<\/w:tc>/gi, "  ")
    .replace(/<w:tab\b[^>]*\/?>/gi, "  ");

  const stripped = withBreaks.replace(/<[^>]+>/g, "");
  return decodeXmlEntities(stripped)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

async function inflateRawBytes(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Browser does not support DecompressionStream for .docx extraction.");
  }
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  void writer.write(new Uint8Array(compressed));
  void writer.close();

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let totalLen = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      totalLen += value.byteLength;
    }
  }

  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function extractDocxXmlFromZip(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const decoder = new TextDecoder("utf-8", { fatal: false });

  // 1. Try Central Directory first (handles data descriptors where local header compressedSize is 0)
  for (let i = 0; i <= bytes.length - 46; i++) {
    if (view.getUint32(i, true) === 0x02014b50) {
      const compressionMethod = view.getUint16(i + 10, true);
      const compressedSize = view.getUint32(i + 20, true);
      const fileNameLength = view.getUint16(i + 28, true);
      const extraLength = view.getUint16(i + 30, true);
      const commentLength = view.getUint16(i + 32, true);
      const localHeaderOffset = view.getUint32(i + 42, true);

      const fileName = decoder.decode(bytes.subarray(i + 46, i + 46 + fileNameLength));
      if (fileName === "word/document.xml" && localHeaderOffset + 30 <= bytes.length) {
        const localNameLen = view.getUint16(localHeaderOffset + 26, true);
        const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
        const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
        const compressedData = bytes.subarray(dataStart, dataStart + compressedSize);

        if (compressionMethod === 0) {
          return decoder.decode(compressedData);
        } else if (compressionMethod === 8) {
          const decompressed = await inflateRawBytes(compressedData);
          return decoder.decode(decompressed);
        }
      }

      i += 45 + fileNameLength + extraLength + commentLength;
    }
  }

  // 2. Fallback: scan Local File Headers directly
  for (let i = 0; i <= bytes.length - 30; i++) {
    if (view.getUint32(i, true) === 0x04034b50) {
      const compressionMethod = view.getUint16(i + 8, true);
      const compressedSize = view.getUint32(i + 18, true);
      const fileNameLength = view.getUint16(i + 26, true);
      const extraLength = view.getUint16(i + 28, true);
      const fileName = decoder.decode(bytes.subarray(i + 30, i + 30 + fileNameLength));
      const dataStart = i + 30 + fileNameLength + extraLength;

      if (fileName === "word/document.xml" && compressedSize > 0) {
        const compressedData = bytes.subarray(dataStart, dataStart + compressedSize);
        if (compressionMethod === 0) {
          return decoder.decode(compressedData);
        } else if (compressionMethod === 8) {
          const decompressed = await inflateRawBytes(compressedData);
          return decoder.decode(decompressed);
        }
      }
    }
  }

  throw new Error(
    "Could not locate word/document.xml inside this .docx file. Please verify the file or paste the syllabus text directly.",
  );
}

function extractTextFromLegacyBinaryDoc(bytes: Uint8Array): string {
  const ignoreMetadata =
    /^(?:Root Entry|WordDocument|1Table|0Table|Data|SummaryInformation|DocumentSummaryInformation|CompObj|Microsoft Word|MSWordDoc|Word\.Document\.\d+|Normal\.dotm?|Default Paragraph Font|Times New Roman|Calibri|Arial|Cambria|Symbol|Wingdings|_PID_HLINKS|Hyperlink|Title|Subject|Author|Keywords|Comments|Template|LastAuthor)$/i;

  const chunks: string[] = [];

  // Extract UTF-16LE runs
  let currentUtf16 = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i]! | (bytes[i + 1]! << 8);
    if (
      code === 0x000d ||
      code === 0x000a ||
      code === 0x0009 ||
      (code >= 0x0020 && code <= 0x007e) ||
      (code >= 0x2010 && code <= 0x2027)
    ) {
      currentUtf16 += code === 0x000d ? "\n" : String.fromCharCode(code);
    } else {
      if (currentUtf16.trim().length >= 12) {
        chunks.push(currentUtf16.trim());
      }
      currentUtf16 = "";
    }
  }
  if (currentUtf16.trim().length >= 12) {
    chunks.push(currentUtf16.trim());
  }

  // Extract ASCII runs
  let currentAscii = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    if (b === 0x0d || b === 0x0a || b === 0x09 || (b >= 0x20 && b <= 0x7e)) {
      currentAscii += b === 0x0d ? "\n" : String.fromCharCode(b);
    } else {
      if (currentAscii.trim().length >= 12) {
        chunks.push(currentAscii.trim());
      }
      currentAscii = "";
    }
  }
  if (currentAscii.trim().length >= 12) {
    chunks.push(currentAscii.trim());
  }

  const lines = chunks
    .flatMap((c) => c.split(/\r?\n/))
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 3 && !ignoreMetadata.test(l) && /[a-zA-Z]{3,}/.test(l));

  return [...new Set(lines)].join("\n");
}

function extractTextFromRtf(rtf: string): string {
  return rtf
    .replace(/\{\\\*[^{}]*\}/g, "")
    .replace(/\\(?:par|line|row)\b\s*/gi, "\n")
    .replace(/\\(?:tab|cell)\b\s*/gi, "  ")
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, "")
    .replace(/[{}]/g, "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Extracts raw text from a PDF (.pdf), Word document (.docx, .doc, .rtf), or plain text (.txt) syllabus file in the browser.
 */
export async function readSyllabusDoc(
  file: File,
  onProgress?: (status: string) => void,
): Promise<string> {
  if (!file) {
    throw new Error(
      "No file provided. Please select a PDF (.pdf), Word (.docx, .doc), or text (.txt) file.",
    );
  }

  const lowerName = file.name.toLowerCase();
  const isPdfFile = lowerName.endsWith(".pdf") || file.type === "application/pdf";
  if (isPdfFile) {
    return readPdf(file, onProgress);
  }

  const isSupportedExt =
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".rtf");

  if (!isSupportedExt) {
    throw new Error(
      `"${file.name}" is not a supported document. Please upload a PDF (.pdf) or Word (.docx, .doc, .rtf, .txt) file, or paste your syllabus text directly.`,
    );
  }

  if (file.size === 0) {
    throw new Error("The selected document is empty (0 bytes). Please upload a valid file.");
  }

  onProgress?.("Reading syllabus document...");

  let arrayBuffer: ArrayBuffer;
  if (typeof file.arrayBuffer === "function") {
    arrayBuffer = await file.arrayBuffer();
  } else {
    arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error("Failed to read file contents."));
      reader.readAsArrayBuffer(file);
    });
  }

  const bytes = new Uint8Array(arrayBuffer);

  // If a PDF file was renamed with a .doc/.txt extension, detect %PDF- magic bytes
  const isPdfMagic =
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d;
  if (isPdfMagic) {
    const pdfFile = new File([arrayBuffer], `${file.name}.pdf`, { type: "application/pdf" });
    return readPdf(pdfFile, onProgress);
  }

  // 1. Check for ZIP magic bytes (PK\x03\x04) -> .docx Office Open XML
  const isZip =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;

  if (isZip || lowerName.endsWith(".docx")) {
    if (!isZip) {
      // Sometimes a plain text or XML file is named .docx
      const rawText = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      if (rawText.includes("<w:document") || rawText.includes("<w:p")) {
        const extracted = extractTextFromWordXml(rawText);
        if (extracted.trim()) return normalizeOcrSyllabusText(extracted);
      }
      if (rawText.trim() && !rawText.includes("\u0000")) {
        return normalizeOcrSyllabusText(rawText.trim());
      }
      throw new Error(
        "The selected .docx file is not a valid Word document archive. Please save as .docx or paste your syllabus text.",
      );
    }

    onProgress?.("Extracting text from Word (.docx) document...");
    const xml = await extractDocxXmlFromZip(arrayBuffer);
    const text = extractTextFromWordXml(xml);
    if (!text.trim()) {
      throw new Error(
        "No readable text found inside this .docx file. Please paste your syllabus text directly.",
      );
    }
    return normalizeOcrSyllabusText(text);
  }

  // 2. Check for OLE2 Compound Document magic bytes (0xD0 0xCF 0x11 0xE0) -> legacy binary .doc
  const isOle2 =
    bytes.length >= 4 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0;

  if (isOle2) {
    onProgress?.("Extracting text from legacy Word (.doc) document...");
    const text = extractTextFromLegacyBinaryDoc(bytes);
    if (!text.trim()) {
      throw new Error(
        "Could not extract readable text from this legacy binary .doc file. Please save it as .docx or paste the syllabus text directly.",
      );
    }
    return normalizeOcrSyllabusText(text);
  }

  // 3. Plain text, RTF, or XML/HTML saved with .doc/.rtf/.txt extension
  const rawString = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (rawString.trimStart().startsWith("{\\rtf") || lowerName.endsWith(".rtf")) {
    const rtfText = extractTextFromRtf(rawString);
    if (!rtfText.trim()) {
      throw new Error("No readable text found in this RTF document.");
    }
    return normalizeOcrSyllabusText(rtfText);
  }

  if (
    rawString.includes("<w:document") ||
    rawString.includes("<w:p") ||
    rawString.includes("<html") ||
    rawString.includes("<body")
  ) {
    const xmlText = extractTextFromWordXml(rawString);
    if (xmlText.trim()) return normalizeOcrSyllabusText(xmlText);
  }

  if (!rawString.trim()) {
    throw new Error("No readable text found in the uploaded file.");
  }

  return normalizeOcrSyllabusText(rawString.trim());
}
