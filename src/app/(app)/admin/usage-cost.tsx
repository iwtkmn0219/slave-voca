// 관리 화면의 이번 달 Gemini 비용 칸(C 화면 규칙 5.2). 정산 전 요청은 예상 비용으로 들어 있다(한도 계산과 같은 값).
export function UsageCost({ spentUsd, budgetUsd, since }: { spentUsd: number; budgetUsd: number; since: string }) {
  const ratio = budgetUsd > 0 ? spentUsd / budgetUsd : 1;
  const percent = Math.min(100, Math.floor(ratio * 100));
  const full = ratio >= 1;
  const fill = full ? "bg-again" : ratio >= 0.8 ? "bg-hard" : "bg-accent";
  return (
    <section className="mb-4 rounded-lg border border-line bg-surface px-[18px] py-3.5 shadow-1">
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <div className="text-xs font-semibold text-muted">이번 달 Gemini 비용</div>
          <div className="tabular-nums">
            <span className="text-xl font-bold">{usd(spentUsd)}</span>
            <span className="text-sm text-muted"> / {usd(budgetUsd)}</span>
          </div>
        </div>
        <div
          role="meter"
          aria-label="이번 달 Gemini 비용"
          aria-valuemin={0}
          aria-valuemax={budgetUsd}
          aria-valuenow={Number(spentUsd.toFixed(2))}
          className="h-1 flex-1 overflow-hidden rounded-full bg-sunken"
        >
          <div className={`h-full ${fill}`} style={{ width: `${percent}%` }} />
        </div>
        <div className="shrink-0 text-xs text-muted tabular-nums">{full ? "상한 도달 · 뜻 만들기 멈춤" : `${percent}%`}</div>
      </div>
      <p className="mt-2 text-[12.5px] text-muted">
        {since}부터 · 한국 시간. 매월 1일 0시에 새로 셉니다. 정산 중인 요청은 예상 비용으로 셉니다.
      </p>
    </section>
  );
}

// 소수 둘째 자리까지, $0.005 미만은 $0.00(반올림).
export function usd(value: number): string {
  return `$${value.toFixed(2)}`;
}
