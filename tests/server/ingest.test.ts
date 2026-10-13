import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { knownWords } from '@/server/db/schema';
import { listCandidates } from '@/server/repo/candidates';
import { getDocument, listDocuments } from '@/server/repo/documents';
import {
  defaultTitle,
  ingestPdf,
  MAX_PDF_BYTES,
  UploadError,
} from '@/server/services/ingest';
import { makePdf } from '../helpers/make-pdf';

// 실제 빈도표(data/frequency.json)를 쓴다. heterogeneous·perturbation은 상위 5,000 밖이다.
const PAPER = [
  'This paper examines heterogeneous datasets with rigor.',
  'The proposed estimator remains stable under perturbations.',
  'We evaluate heterogeneous perturbations on several benchmarks.',
  'Results confirm that the estimator generalizes across domains.',
];

let db: Db;
beforeEach(() => {
  db = createDb(':memory:');
});

const input = (bytes: Uint8Array, title = '') => ({
  fileName: 'attention.pdf',
  title,
  kind: 'paper' as const,
  bytes,
});

describe('ingestPdf', () => {
  it('stores candidates and moves the document to reviewing', async () => {
    const result = await ingestPdf(db, input(makePdf([PAPER])));
    expect(result.status).toBe('reviewing');
    const lemmas = listCandidates(db, result.documentId).map((c) => c.lemma);
    expect(lemmas).toContain('heterogeneous');
    expect(lemmas).toContain('perturbation');
    expect(lemmas).not.toContain('paper');
  });

  it('applies the real word lists: academic rescue, dictionary flag, line-end compounds', async () => {
    const pdf = makePdf([
      [
        ...PAPER,
        'Hence the conv layers need careful fine-',
        'tuning on heterogeneous data.',
        'Contact avaswani@google.com for the code.',
        'The shift in-',
        'variance of the estimator holds.',
      ],
    ]);
    const result = await ingestPdf(db, input(pdf));
    const byLemma = new Map(listCandidates(db, result.documentId).map((c) => [c.lemma, c]));
    expect(byLemma.has('hence')).toBe(true); // 순위 4567, AWL 대표어
    expect(byLemma.get('conv')?.inDictionary).toBe(false);
    expect(byLemma.get('heterogeneous')?.inDictionary).toBe(true);
    expect(byLemma.has('finetuning')).toBe(false);
    expect(byLemma.has('avaswani')).toBe(false);
    expect(byLemma.has('invariance')).toBe(true); // 드문 단어는 줄 끝에서 잘려도 살아남는다
  });

  it('accepts a PDF whose header follows a few junk bytes', async () => {
    const pdf = makePdf([PAPER]);
    const withJunk = new Uint8Array(pdf.length + 3);
    withJunk.set([0xef, 0xbb, 0xbf]);
    withJunk.set(pdf, 3);
    const result = await ingestPdf(db, input(withJunk));
    expect(result.status).toBe('reviewing');
  });

  it('uses the file name when the title is blank', async () => {
    const result = await ingestPdf(db, input(makePdf([PAPER]), '   '));
    expect(getDocument(db, result.documentId)?.title).toBe('attention');
  });

  it('skips lemmas the user already knows', async () => {
    db.insert(knownWords).values({ lemma: 'heterogeneous' }).run();
    const result = await ingestPdf(db, input(makePdf([PAPER])));
    const lemmas = listCandidates(db, result.documentId).map((c) => c.lemma);
    expect(lemmas).not.toContain('heterogeneous');
  });

  it('marks the document done when nothing is left to learn', async () => {
    const common = Array(6).fill('The people of the world have a good time and work.');
    const result = await ingestPdf(db, input(makePdf([common])));
    expect(result.status).toBe('done');
    expect(listCandidates(db, result.documentId)).toEqual([]);
  });

  it('records a readable error for a PDF without text', async () => {
    const result = await ingestPdf(db, input(makePdf([['Figure 1']])));
    expect(result.status).toBe('error');
    expect(getDocument(db, result.documentId)?.errorMessage).toContain('스캔 PDF');
  });

  it('records a generic error for a corrupt PDF', async () => {
    const corrupt = new TextEncoder().encode('%PDF-1.4\nthis is not really a pdf');
    const result = await ingestPdf(db, input(corrupt));
    expect(result.status).toBe('error');
    expect(getDocument(db, result.documentId)?.errorMessage).toBe('PDF를 처리하지 못했습니다.');
  });

  it('rejects files that are not PDFs without creating a document', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    await expect(ingestPdf(db, input(png))).rejects.toThrow('PDF 파일이 아닙니다.');
    expect(listDocuments(db)).toEqual([]);
  });

  it('rejects empty and oversized files', async () => {
    await expect(ingestPdf(db, input(new Uint8Array()))).rejects.toBeInstanceOf(UploadError);
    const huge = new Uint8Array(MAX_PDF_BYTES + 1);
    huge.set(new TextEncoder().encode('%PDF-'));
    await expect(ingestPdf(db, input(huge))).rejects.toThrow('50MB');
  });
});

describe('defaultTitle', () => {
  it('strips the .pdf extension', () => {
    expect(defaultTitle('My Paper.PDF')).toBe('My Paper');
    expect(defaultTitle('.pdf')).toBe('제목 없음');
  });
});
