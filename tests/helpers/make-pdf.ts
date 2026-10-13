// 테스트용 최소 PDF. pages[i]는 i번째 페이지의 줄 목록이다.
// 한 줄은 약 100자 이내로: 페이지 밖으로 나간 글자는 pdf.js가 추출하지 않는다.
export function makePdf(pages: string[][]): Uint8Array {
  const escape = (s: string) => s.replace(/[\\()]/g, (c) => '\\' + c);
  const objects: string[] = [];
  const pageIds: number[] = [];
  const fontId = 3;
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  let next = 4;
  for (const lines of pages) {
    const stream =
      'BT /F1 10 Tf 40 760 Td 12 TL\n' +
      lines.map((l) => `(${escape(l)}) Tj T*`).join('\n') +
      '\nET';
    const contentId = next++;
    const pageId = next++;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`;
    pageIds.push(pageId);
  }
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
