import pdfParse from "pdf-parse";
import JSZip from "jszip";

export interface ParseResult {
  text: string;
  metadata: {
    title?: string;
    author?: string;
    pageCount?: number;
    fileType: "pdf" | "hwpx" | "hwp" | "docx";
  };
}

export async function extractText(buffer: Buffer, fileType: string): Promise<ParseResult> {
  switch (fileType.toLowerCase()) {
    case "pdf":
      return extractPdf(buffer);
    case "hwpx":
      return extractHwpx(buffer);
    case "hwp":
      return extractHwp();
    case "docx":
      return extractDocx(buffer);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

async function extractPdf(buffer: Buffer): Promise<ParseResult> {
  const data = await pdfParse(buffer);
  return {
    text: data.text,
    metadata: {
      title: data.info?.Title ?? undefined,
      author: data.info?.Author ?? undefined,
      pageCount: data.numpages,
      fileType: "pdf",
    },
  };
}

async function extractHwpx(buffer: Buffer): Promise<ParseResult> {
  const zip = new JSZip();
  const archive = await zip.loadAsync(buffer);
  const texts: string[] = [];

  for (let i = 0; i < 100; i++) {
    const entry = archive.file(`Contents/section${i}.xml`);
    if (!entry) break;
    const xml = await entry.async("text");
    const matches = xml.match(/<T[^>]*>([^<]*)<\/T>/g) || [];
    for (const m of matches) {
      const text = m.replace(/<[^>]+>/g, "").trim();
      if (text) texts.push(text);
    }
  }

  return {
    text: texts.join("\n"),
    metadata: { fileType: "hwpx" },
  };
}

async function extractHwp(): Promise<ParseResult> {
  return {
    text: "HWP 바이너리 형식은 직접 파싱이 제한적입니다. HWPX로 변환 후 처리를 권장합니다.",
    metadata: { fileType: "hwp" },
  };
}

async function extractDocx(buffer: Buffer): Promise<ParseResult> {
  const zip = new JSZip();
  const archive = await zip.loadAsync(buffer);
  const docXml = archive.file("word/document.xml");
  if (!docXml) {
    return { text: "", metadata: { fileType: "docx" } };
  }

  const xml = await docXml.async("text");
  const matches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  const texts = matches.map((m) => m.replace(/<[^>]+>/g, ""));

  return {
    text: texts.join(" "),
    metadata: { fileType: "docx" },
  };
}
