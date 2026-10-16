import { inDictionary, isRealWord } from '@/lib/extract/dictionary';
import { extractCandidates } from '@/lib/extract/extract';
import { isFrequentWord, rankOf } from '@/lib/extract/frequency';
import { NoTextError, parsePdf } from '@/lib/pdf/parse';
import { MAX_PDF_BYTES, pdfSizeError } from '@/lib/upload/limits';
import type { Db } from '../db/client';
import type { DocumentKind, DocumentStatus } from '../db/schema';
import { replaceCandidates } from '../repo/candidates';
import { createDocument, updateDocumentStatus } from '../repo/documents';
import { getSettings } from '../repo/settings';
import { listKnownLemmas, listWordLemmas } from '../repo/vocabulary';

export { MAX_PDF_BYTES };

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

export interface IngestInput {
  fileName: string;
  title: string;
  kind: DocumentKind;
  bytes: Uint8Array;
}

export interface IngestResult {
  documentId: number;
  status: DocumentStatus;
}

const PDF_MAGIC = '%PDF-';
// PDF 규격은 파일 앞 1,024바이트 안에 헤더가 있으면 허용한다(앞에 붙은 쓰레기 바이트).
const PDF_MAGIC_WINDOW = 1024;

export function validateUpload(bytes: Uint8Array): void {
  const sizeError = pdfSizeError(bytes.length);
  if (sizeError) throw new UploadError(sizeError);
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, PDF_MAGIC_WINDOW));
  if (!head.includes(PDF_MAGIC)) throw new UploadError('PDF 파일이 아닙니다.');
}

export function defaultTitle(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '').trim() || '제목 없음';
}

// 업로드 검증 → 문서 생성 → 문장 추출 → 후보 저장. 처리 실패는 문서 상태(error)로 남긴다.
export async function ingestPdf(db: Db, input: IngestInput): Promise<IngestResult> {
  validateUpload(input.bytes);
  const title = input.title.trim() || defaultTitle(input.fileName);
  const doc = createDocument(db, { title, kind: input.kind });

  try {
    const sentences = await parsePdf(input.bytes, { isKnownWord: isFrequentWord, isRealWord });
    const settings = getSettings(db);
    const found = extractCandidates(sentences, {
      excludeTopN: settings.excludeTopN,
      rankOf,
      knownLemmas: listKnownLemmas(db),
      existingLemmas: listWordLemmas(db),
      inDictionary,
    });
    replaceCandidates(db, doc.id, found);
    const status: DocumentStatus = found.length === 0 ? 'done' : 'reviewing';
    updateDocumentStatus(db, doc.id, status);
    return { documentId: doc.id, status };
  } catch (err) {
    if (!(err instanceof NoTextError)) console.error('PDF 처리 실패', err);
    const message = err instanceof NoTextError ? err.message : 'PDF를 처리하지 못했습니다.';
    updateDocumentStatus(db, doc.id, 'error', message);
    return { documentId: doc.id, status: 'error' };
  }
}
