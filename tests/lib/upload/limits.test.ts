import { describe, expect, it } from 'vitest';
import { MAX_PDF_BYTES, pdfSizeError } from '@/lib/upload/limits';

describe('pdfSizeError', () => {
  it('accepts files up to 50MB', () => {
    expect(pdfSizeError(1)).toBeNull();
    expect(pdfSizeError(MAX_PDF_BYTES)).toBeNull();
  });

  it('rejects empty and oversized files with readable messages', () => {
    expect(pdfSizeError(0)).toBe('PDF 파일을 선택하세요.');
    // 51MB 본문 제한을 넘는 파일은 서버 액션까지 오지 못하므로 폼에서 먼저 막는다.
    expect(pdfSizeError(60 * 1024 * 1024)).toBe('50MB 이하의 PDF만 올릴 수 있습니다.');
  });
});
