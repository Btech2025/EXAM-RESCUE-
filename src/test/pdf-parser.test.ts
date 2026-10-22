import { describe, expect, it } from "vitest";
import { readPdf, readSyllabusDoc } from "@/lib/pdf";

describe("PDF & Word Doc Syllabus Parser", () => {
  it("rejects non-PDF file uploads with clear error", async () => {
    const fakeFile = new File(["hello world"], "notes.txt", { type: "text/plain" });
    await expect(readPdf(fakeFile)).rejects.toThrow(/not a PDF file/i);
  });

  it("rejects empty 0-byte PDF files", async () => {
    const emptyFile = new File([], "empty.pdf", { type: "application/pdf" });
    await expect(readPdf(emptyFile)).rejects.toThrow(/empty \(0 bytes\)/i);
  });

  it("rejects corrupt files missing standard %PDF- magic bytes header", async () => {
    const corruptFile = new File(["This is just random text with no PDF header"], "fake.pdf", {
      type: "application/pdf",
    });
    await expect(readPdf(corruptFile)).rejects.toThrow(/missing standard %PDF header/i);
  });

  it("extracts syllabus text from Word XML (.docx / .doc) and .txt files", async () => {
    const wordXml = `<w:document><w:body><w:p><w:r><w:t>UNIT I: Process Management</w:t></w:r></w:p><w:p><w:r><w:t>CPU scheduling, Threads, Concurrency</w:t></w:r></w:p></w:body></w:document>`;
    const docFile = new File([wordXml], "syllabus.doc", { type: "application/msword" });
    const extracted = await readSyllabusDoc(docFile);
    expect(extracted).toContain("UNIT I: Process Management");
    expect(extracted).toContain("CPU scheduling, Threads, Concurrency");
  });

  it("supports .pdf syllabus files in readSyllabusDoc by delegating to readPdf", async () => {
    const invalidPdfFile = new File(["Not a valid PDF binary"], "syllabus.pdf", {
      type: "application/pdf",
    });
    await expect(readSyllabusDoc(invalidPdfFile)).rejects.toThrow(/missing standard %PDF header/i);
  });
});
