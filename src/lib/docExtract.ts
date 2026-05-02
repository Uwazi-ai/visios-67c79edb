// Client-side document text extraction for KB uploads.
import mammoth from "mammoth";

export async function extractText(file: File): Promise<{ text: string; type: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const lowerType = file.type.toLowerCase();

  if (ext === "txt" || ext === "md" || lowerType.startsWith("text/")) {
    const text = await file.text();
    return { text, type: ext || "txt" };
  }

  if (ext === "docx" || lowerType.includes("officedocument.wordprocessingml")) {
    const buf = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    return { text: value, type: "docx" };
  }

  if (ext === "pdf" || lowerType === "application/pdf") {
    // Lazy-load pdfjs to avoid worker setup at module load.
    const pdfjs: any = await import("pdfjs-dist");
    const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it: any) => it.str).join(" ") + "\n\n";
    }
    return { text: text.trim(), type: "pdf" };
  }

  throw new Error(`Unsupported file type: ${ext || file.type}`);
}
