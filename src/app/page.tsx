import Link from "next/link";

// 오늘의 복습 요약은 마일스톤 3에서 채운다.
export default function Home() {
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">slave-voca</h1>
      <p>논문·발표 PDF를 올리면 외울 단어를 뽑아줍니다.</p>
      <Link href="/documents" className="inline-block rounded bg-black px-4 py-2 text-white">
        문서 올리기
      </Link>
    </main>
  );
}
