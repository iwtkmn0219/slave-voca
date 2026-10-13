"use client";

import { useActionState, useState, type FormEvent } from "react";
import { pdfSizeError } from "@/lib/upload/limits";
import { uploadDocument, type UploadState } from "./actions";

const initialState: UploadState = { error: null };

export function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadDocument, initialState);
  const [sizeError, setSizeError] = useState<string | null>(null);

  // 51MB를 넘는 본문은 Next가 서버 액션 전에 거부하므로, 크기는 제출 전에 여기서 알린다.
  const checkSize = (event: FormEvent<HTMLFormElement>) => {
    const file = new FormData(event.currentTarget).get("file");
    const error = file instanceof File ? pdfSizeError(file.size) : null;
    setSizeError(error);
    if (error) event.preventDefault();
  };

  const error = sizeError ?? state.error;

  return (
    <form action={formAction} onSubmit={checkSize} className="space-y-3 rounded border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="file" name="file" accept="application/pdf,.pdf" required />
        <select name="kind" defaultValue="paper" className="rounded border px-2 py-1">
          <option value="paper">논문</option>
          <option value="presentation">발표</option>
        </select>
        <input
          type="text"
          name="title"
          placeholder="제목 (비우면 파일 이름)"
          className="min-w-64 flex-1 rounded border px-2 py-1"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-4 py-1 text-white disabled:opacity-50"
        >
          {pending ? "단어 추출 중…" : "올리기"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
