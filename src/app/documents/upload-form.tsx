"use client";

import { useActionState, useRef, useState, type DragEvent, type FormEvent } from "react";
import { buttonClass } from "@/components/ui/button";
import { Spinner } from "@/components/ui/status";
import { pdfSizeError } from "@/lib/upload/limits";
import { uploadDocument, type UploadState } from "./actions";

const initialState: UploadState = { error: null };

const KINDS = [
  { value: "paper", label: "논문" },
  { value: "presentation", label: "발표" },
] as const;

export function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadDocument, initialState);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // 51MB를 넘는 본문은 Next가 서버 액션 전에 거부하므로, 크기는 제출 전에 여기서 알린다.
  const checkSize = (event: FormEvent<HTMLFormElement>) => {
    const file = new FormData(event.currentTarget).get("file");
    const error = file instanceof File ? pdfSizeError(file.size) : null;
    setSizeError(error);
    if (error) event.preventDefault();
  };

  // 끌어다 놓은 파일을 같은 <input type=file>에 넣어 기존 제출 흐름을 그대로 쓴다.
  const onDrop = (event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDragging(false);
    const files = event.dataTransfer.files;
    if (files.length === 0 || !fileInput.current) return;
    fileInput.current.files = files;
    setFileName(files[0].name);
  };

  const error = sizeError ?? state.error;

  return (
    <form
      action={formAction}
      onSubmit={checkSize}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`rounded-lg border-[1.5px] border-dashed bg-surface p-3.5 ${
        dragging ? "border-accent" : "border-line-strong"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-[260px] flex-1 cursor-pointer items-center gap-2.5 text-sm text-ink-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden>
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3" />
          </svg>
          {fileName ? (
            <span className="truncate font-semibold text-ink">{fileName}</span>
          ) : (
            <span>
              PDF를 끌어다 놓거나 <span className="font-semibold text-accent">파일 선택</span>
              <span className="text-[13px] text-muted"> · 50MB까지</span>
            </span>
          )}
          <input
            ref={fileInput}
            type="file"
            name="file"
            accept="application/pdf,.pdf"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="sr-only"
          />
        </label>
        <fieldset className="inline-flex overflow-hidden rounded-md border border-line-strong">
          <legend className="sr-only">종류</legend>
          {KINDS.map((k) => (
            <label
              key={k.value}
              className="cursor-pointer px-3 py-1.5 text-[13px] text-ink-2 has-checked:bg-ink has-checked:font-semibold has-checked:text-surface has-focus-visible:outline-2 has-focus-visible:outline-accent"
            >
              <input type="radio" name="kind" value={k.value} defaultChecked={k.value === "paper"} className="sr-only" />
              {k.label}
            </label>
          ))}
        </fieldset>
        <input
          type="text"
          name="title"
          placeholder="제목 (비우면 파일 이름)"
          className="min-w-0 flex-[1_1_240px] rounded-md border border-line-strong bg-surface px-2.5 py-[7px] text-sm text-ink placeholder:text-muted"
        />
        <button type="submit" disabled={pending} className={buttonClass({ variant: "primary" })}>
          {pending && <Spinner className="border-on-accent border-r-transparent" />}
          {pending ? "단어 추출 중…" : "올리기"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2.5 text-sm text-again">
          {error}
        </p>
      )}
    </form>
  );
}
