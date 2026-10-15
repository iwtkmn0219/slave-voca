// 몇 개 중 하나를 고르는 칸(업로드 종류, 설정의 테마·자동 재생). 의미상 라디오 그룹이라
// 보이지 않는 radio에 label을 씌운다. 화살표 키 이동은 브라우저 기본 동작이다.
export function Segmented<T extends string>({
  name,
  legend,
  options,
  value,
  defaultValue,
  onChange,
}: {
  name: string;
  legend: string;
  options: readonly { value: T; label: string }[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
}) {
  return (
    <fieldset className="inline-flex overflow-hidden rounded-md border border-line-strong">
      <legend className="sr-only">{legend}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className="cursor-pointer px-3 py-1.5 text-[13px] text-ink-2 has-checked:bg-ink has-checked:font-semibold has-checked:text-surface has-focus-visible:outline-2 has-focus-visible:outline-accent"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            {...(value === undefined ? { defaultChecked: o.value === defaultValue } : { checked: o.value === value })}
            onChange={() => onChange?.(o.value)}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}
