// Segmented toggle (a small radio group of buttons).
type SegProps<T extends string | number> = { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }

export function Seg<T extends string | number>({ value, options, onChange, label }: SegProps<T>) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={String(v)} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  )
}
