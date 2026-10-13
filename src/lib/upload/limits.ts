// 서버(ingest)와 업로드 폼이 함께 쓰는 크기 제한. 서버 전용 의존성을 두지 않는다.
export const MAX_PDF_BYTES = 50 * 1024 * 1024;

export function pdfSizeError(size: number): string | null {
  if (size === 0) return 'PDF 파일을 선택하세요.';
  if (size > MAX_PDF_BYTES) return '50MB 이하의 PDF만 올릴 수 있습니다.';
  return null;
}
