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
