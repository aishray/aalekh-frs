'use client';

import type { Project } from '@/lib/types';
import { digitiseFile } from '@/lib/ai/client';

export type Extracted = { text: string; method: 'pdf' | 'docx' | 'text' | 'digitised'; note?: string };

async function pdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // The worker is copied to public/ by the prebuild/predev scripts.
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Rebuild lines from text items using their y position.
    let lastY: number | null = null;
    let line = '';
    const lines: string[] = [];
    for (const it of content.items as { str: string; transform: number[]; hasEOL?: boolean }[]) {
      const y = it.transform?.[5];
      if (lastY != null && y != null && Math.abs(y - lastY) > 2) {
        lines.push(line.trim());
        line = '';
      }
      line += it.str;
      if (it.hasEOL) {
        lines.push(line.trim());
        line = '';
      }
      lastY = y ?? lastY;
    }
    if (line.trim()) lines.push(line.trim());
    pages.push(lines.join('\n'));
  }
  return pages.join('\n\n');
}

/** Text extraction: pdfjs for PDFs, mammoth for DOCX, plain read for text. Scanned PDFs and images go to Sarvam Document Intelligence. */
export async function extractText(project: Project | undefined, file: File): Promise<Extracted> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) return { text: await file.text(), method: 'text' };
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth/mammoth.browser');
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { text: r.value, method: 'docx' };
  }
  if (name.endsWith('.pdf')) {
    const text = await pdfText(file);
    // A PDF with almost no text layer is a scan.
    if (text.replace(/\s/g, '').length > 80) return { text, method: 'pdf' };
    return { text: await digitiseFile(project, file), method: 'digitised', note: 'Scanned PDF read with Sarvam Document Intelligence.' };
  }
  if (file.type.startsWith('image/') || /\.(png|jpe?g|tiff?)$/.test(name))
    return { text: await digitiseFile(project, file), method: 'digitised', note: 'Scanned image read with Sarvam Document Intelligence.' };
  throw new Error('Unsupported file type. Upload PDF, DOCX, TXT or an image, or paste the text.');
}
