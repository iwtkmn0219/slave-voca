"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { buttonClass } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Failed, Status } from "@/components/ui/status";
import {
  DAILY_NEW_LIMIT_RANGE,
  EXCLUDE_TOP_N_RANGE,
  type SettingsErrors,
  type SettingsField,
  type Theme,
} from "@/lib/settings";
import { applyTheme } from "@/lib/ui/theme";
import { saveSettingsAction } from "./actions";

interface Values {
  excludeTopN: number;
  dailyNewLimit: number;
  autoSpeak: boolean;
  theme: Theme;
}

const THEME_OPTIONS = [
  { value: "system", label: "시스템" },
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
] as const;

const SPEAK_OPTIONS = [
  { value: "off", label: "끄기" },
  { value: "on", label: "켜기" },
] as const;

type Outcome = { kind: "saved" } | { kind: "invalid" } | { kind: "error"; message: string } | null;

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-semibold text-muted">{title}</h2>
      <div className="mt-2 border-t border-line">{children}</div>
    </section>
  );
}

// 개편안 5.6의 2열 행: 라벨 200px(이름 + 설명) + 입력. 900px 이하에서는 1열.
function Row({ id, name, help, children }: { id?: string; name: string; help: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-x-6 gap-y-2 border-b border-line py-4 max-[900px]:grid-cols-1">
      <div>
        {id ? (
          <label htmlFor={id} className="text-sm font-semibold">
            {name}
          </label>
        ) : (
          <p className="text-sm font-semibold">{name}</p>
        )}
        <p className="mt-0.5 text-[13px] text-muted">{help}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function NumberField({
  id,
  value,
  onChange,
  range,
  unit,
  error,
}: {
  id: SettingsField;
  value: string;
  onChange: (v: string) => void;
  range: { min: number; max: number };
  unit: string;
  error: string | undefined;
}) {
  return (
    <>
      <span className="inline-flex items-center gap-2">
        <input
          id={id}
          name={id}
          type="number"
          inputMode="numeric"
          min={range.min}
          max={range.max}
          step={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          // 오류 칸은 포커스 중에도 again 테두리를 유지하고, 포커스 링은 바깥에 둔다(Designer).
          // 증감 화살표는 숨긴다(범위가 넓어 쓸 일이 없다). 키보드 ↑↓는 그대로다.
          className={`w-[120px] [appearance:textfield] rounded-md border border-line-strong bg-surface px-2.5 py-[7px] text-sm text-ink tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-invalid:border-again [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        />
        <span className="text-sm text-ink-2">{unit}</span>
      </span>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] text-again">
          {error}
        </p>
      )}
    </>
  );
}

export function SettingsForm({ initial }: { initial: Values }) {
  const [excludeTopN, setExcludeTopN] = useState(String(initial.excludeTopN));
  const [dailyNewLimit, setDailyNewLimit] = useState(String(initial.dailyNewLimit));
  const [autoSpeak, setAutoSpeak] = useState(initial.autoSpeak);
  const [theme, setTheme] = useState<Theme>(initial.theme);
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [saving, startSaving] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  // 입력을 바꾸면 "저장했습니다"는 사라지고, 고치기 시작한 칸의 오류 표시도 지운다.
  const edited = (field?: SettingsField) => {
    if (outcome?.kind === "saved") setOutcome(null);
    if (field && errors[field])
      setErrors((e) => {
        const next = { ...e };
        delete next[field];
        return next;
      });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    startSaving(async () => {
      const result = await saveSettingsAction({ excludeTopN, dailyNewLimit, autoSpeak, theme });
      if (result.status === "saved") {
        setErrors({});
        setOutcome({ kind: "saved" });
        applyTheme(theme); // 쿠키는 서버가 저장했다. 지금 화면에도 바로 적용한다
      } else if (result.status === "invalid") {
        setErrors(result.errors);
        setOutcome({ kind: "invalid" });
        const first = (["excludeTopN", "dailyNewLimit"] as const).find((f) => result.errors[f]);
        if (first) form.current?.querySelector<HTMLInputElement>(`#${first}`)?.focus();
      } else {
        setOutcome({ kind: "error", message: result.message });
      }
    });
  };

  return (
    <form ref={form} noValidate onSubmit={submit}>
      <Group title="단어 추출">
        <Row id="excludeTopN" name="흔한 단어 제외 기준" help="빈도 상위 N위 안의 단어는 후보에서 뺍니다. 학술 핵심어는 남깁니다.">
          <NumberField
            id="excludeTopN"
            value={excludeTopN}
            onChange={(v) => {
              setExcludeTopN(v);
              edited("excludeTopN");
            }}
            range={EXCLUDE_TOP_N_RANGE}
            unit="위"
            error={errors.excludeTopN}
          />
          <p className="mt-1.5 text-[13px] text-muted">
            다음에 올리는 문서부터 적용됩니다. 이미 뽑은 후보와 카드는 그대로입니다.
          </p>
        </Row>
      </Group>

      <Group title="복습">
        <Row id="dailyNewLimit" name="하루 새 카드 수" help="남은 새 카드는 다음 날로 넘어갑니다. 0이면 새 카드 없이 복습만 합니다.">
          <NumberField
            id="dailyNewLimit"
            value={dailyNewLimit}
            onChange={(v) => {
              setDailyNewLimit(v);
              edited("dailyNewLimit");
            }}
            range={DAILY_NEW_LIMIT_RANGE}
            unit="장"
            error={errors.dailyNewLimit}
          />
        </Row>
        <Row name="발음 자동 재생" help="뒷면을 열 때 단어를 한 번 읽어 줍니다. P 키와 스피커 버튼은 그대로입니다.">
          <Segmented
            name="autoSpeak"
            legend="발음 자동 재생"
            options={SPEAK_OPTIONS}
            value={autoSpeak ? "on" : "off"}
            onChange={(v) => {
              setAutoSpeak(v === "on");
              edited();
            }}
          />
        </Row>
      </Group>

      <Group title="화면">
        <Row name="화면 테마" help="시스템은 운영체제 설정을 따릅니다.">
          <Segmented
            name="theme"
            legend="화면 테마"
            options={THEME_OPTIONS}
            value={theme}
            onChange={(v) => {
              setTheme(v);
              edited();
            }}
          />
        </Row>
      </Group>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className={buttonClass({ variant: "primary" })}>
          {saving ? "저장 중…" : "저장"}
        </button>
        <span aria-live="polite">
          {outcome?.kind === "saved" && <Status tone="ok">저장했습니다</Status>}
          {outcome?.kind === "invalid" && <Failed>저장하지 않았습니다 · 표시한 항목을 고쳐 주세요</Failed>}
          {outcome?.kind === "error" && <Failed>{outcome.message}</Failed>}
        </span>
      </div>
    </form>
  );
}
