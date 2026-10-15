import { highlight } from "@/lib/text/highlight";

// 원문 문장에서 단어를 형광펜(<mark>)으로 표시한다. 글꼴은 부모(font-en)를 따른다.
export function Highlighted({ sentence, word }: { sentence: string; word: string }) {
  return (
    <>
      {highlight(sentence, word).map((seg, i) =>
        seg.match ? <mark key={i}>{seg.text}</mark> : <span key={i}>{seg.text}</span>,
      )}
    </>
  );
}
