"use client";

import { useActionState } from "react";
import { uploadDocument, type UploadState } from "./actions";

const initialState: UploadState = { error: null };

export function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadDocument, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded border p-4">
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
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
