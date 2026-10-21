import { describe, expect, it } from "vitest";
import { readPdf } from "@/lib/pdf";

describe("PDF Parser & Error Handling", () => {
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
});
