/**
 * PDF text extraction using pdfjs-dist.
 * DOM-bound (uses File API), so no unit tests.
 */

import * as pdfjsLib from "pdfjs-dist";
import { GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configure worker for Vite
GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PAGES = 60;
const MAX_CHARS = 400_000;

/**
 * Extract plain text from a PDF file.
 * @param file - PDF file from file input
 * @returns Plain text content (limited to first 60 pages and 400k chars)
 * @throws Error if PDF cannot be loaded or parsed
 */
export async function extractPdfText(file: File): Promise<string> {
  if (!file) {
    throw new Error("No file provided");
  }

  if (!file.type || !file.type.includes("pdf")) {
    throw new Error("File must be a PDF");
  }

  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Load PDF document
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const numPages = Math.min(pdf.numPages, MAX_PAGES);
  let fullText = "";

  // Extract text from each page
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Concatenate text items with spaces
    const pageText = textContent.items
      .map((item) => {
        if ("str" in item) {
          return item.str;
        }
        return "";
      })
      .join(" ");

    fullText += pageText + "\n\n";

    // Stop if we exceed character limit
    if (fullText.length >= MAX_CHARS) {
      fullText = fullText.slice(0, MAX_CHARS);
      break;
    }
  }

  return fullText.trim();
}
