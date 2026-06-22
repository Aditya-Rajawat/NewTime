import type {
  ActiveWordEffect,
  CaptionBackgroundMode,
  CaptionPosition,
  CaptionStyle,
  EntranceAnimation,
  StylePreset,
  TextTransform,
} from '../lib/types'
import { FONT_OPTIONS } from '../lib/presets'

interface Props {
  style: CaptionStyle
  presets: StylePreset[]
  activePresetId: string | null
  onSelectPreset: (preset: StylePreset) => void
  onChange: (patch: Partial<CaptionStyle>) => void
}

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs font-bold text-white/60">
        <span>{label}</span>
        {hint && <span className="font-mono text-white/40">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm font-medium text-white outline-none focus:border-fuchsia-400/60"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[#15151f]">
          {o.label}
        </option>
      ))}
    </select>
  )
}

function Range({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1.5 w-full cursor-pointer"
    />
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
      <span className="text-xs font-bold text-white/60">{label}</span>
      <input
        type="color"
        value={toHex(value)}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
      />
    </label>
  )
}

function toHex(color: string): string {
  if (color.startsWith('#')) return color.slice(0, 7)
  const m = color.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const [r, g, b] = m[1].split(',').map((n) => parseInt(n.trim(), 10))
    return (
      '#' +
      [r, g, b]
        .map((c) => (isNaN(c) ? 0 : c).toString(16).padStart(2, '0'))
        .join('')
    )
  }
  return '#000000'
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function getAlpha(color: string): number {
  const m = color.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const parts = m[1].split(',')
    return parts.length === 4 ? parseFloat(parts[3]) : 1
  }
  return color === 'transparent' ? 0 : 1
}

export default function StylePanel({
  style,
  presets,
  activePresetId,
  onSelectPreset,
  onChange,
}: Props) {
  const bgAlpha = getAlpha(style.backgroundColor)

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
              Templates
            </h3>
            <p className="mt-1 text-sm text-white/50">
              Pick a free caption style, then tune every detail.
            </p>
          </div>
          <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
            Free
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2" id="templates">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectPreset(p)}
              title={p.description}
              className={`group rounded-2xl border p-2 text-left transition ${
                activePresetId === p.id
                  ? 'border-fuchsia-300 bg-fuchsia-500/15 text-white shadow-lg shadow-fuchsia-950/25'
                  : 'border-white/10 bg-black/20 text-white/70 hover:border-white/25 hover:bg-white/[0.05]'
              }`}
            >
              <div
                className="mb-2 flex h-16 items-center justify-center rounded-xl border border-white/10 bg-black/35 px-2 text-center shadow-inner"
                style={{
                  color: p.style.textColor,
                  textShadow: `0 0 10px ${p.style.shadowColor}`,
                  fontFamily: p.style.fontFamily,
                  fontWeight: p.style.fontWeight,
                }}
              >
                <span className="rounded-lg px-2 py-1 text-sm font-black uppercase leading-none">
                  {p.name}
                </span>
              </div>
              <span className="font-black">{p.name}</span>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">
                {p.description}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border border-white/10 bg-black/20 p-3">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
          Text
        </h3>
        <Field label="Font">
          <Select
            value={style.fontFamily}
            onChange={(v) => onChange({ fontFamily: v })}
            options={FONT_OPTIONS}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Weight" hint={String(style.fontWeight)}>
            <Range
              value={style.fontWeight}
              min={400}
              max={900}
              step={100}
              onChange={(v) => onChange({ fontWeight: v })}
            />
          </Field>
          <Field label="Size" hint={`${Math.round(style.fontSize * 100)}%`}>
            <Range
              value={style.fontSize}
              min={0.03}
              max={0.12}
              step={0.002}
              onChange={(v) => onChange({ fontSize: v })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Case">
            <Select<TextTransform>
              value={style.textTransform}
              onChange={(v) => onChange({ textTransform: v })}
              options={[
                { value: 'none', label: 'As written' },
                { value: 'uppercase', label: 'UPPERCASE' },
                { value: 'lowercase', label: 'lowercase' },
              ]}
            />
          </Field>
          <Field label="Words / cue" hint={String(style.maxWordsPerCue)}>
            <Range
              value={style.maxWordsPerCue}
              min={1}
              max={10}
              step={1}
              onChange={(v) => onChange({ maxWordsPerCue: v })}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border border-white/10 bg-black/20 p-3">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
          Motion & emphasis
        </h3>
        <Field label="Entrance">
          <Select<EntranceAnimation>
            value={style.entrance}
            onChange={(v) => onChange({ entrance: v })}
            options={[
              { value: 'none', label: 'None' },
              { value: 'fade', label: 'Fade in' },
              { value: 'pop', label: 'Pop' },
              { value: 'slide-up', label: 'Slide up' },
              { value: 'word-by-word', label: 'Word by word' },
            ]}
          />
        </Field>
        <Field label="Active word">
          <Select<ActiveWordEffect>
            value={style.activeWordEffect}
            onChange={(v) => onChange({ activeWordEffect: v })}
            options={[
              { value: 'none', label: 'No emphasis' },
              { value: 'reveal', label: 'Brighten as spoken' },
              { value: 'color', label: 'Recolour' },
              { value: 'highlight', label: 'Highlight box' },
              { value: 'scale', label: 'Scale up' },
            ]}
          />
        </Field>
      </section>

      <section className="space-y-3 rounded-3xl border border-white/10 bg-black/20 p-3">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
          Colors
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <ColorField
            label="Text"
            value={style.textColor}
            onChange={(v) => onChange({ textColor: v })}
          />
          <ColorField
            label="Active"
            value={style.activeColor}
            onChange={(v) => onChange({ activeColor: v })}
          />
          <ColorField
            label="Highlight"
            value={style.highlightColor}
            onChange={(v) => onChange({ highlightColor: v })}
          />
          <ColorField
            label="Outline"
            value={style.strokeColor}
            onChange={(v) => onChange({ strokeColor: v })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Outline" hint={`${Math.round(style.strokeWidth * 100)}%`}>
            <Range
              value={style.strokeWidth}
              min={0}
              max={0.25}
              step={0.01}
              onChange={(v) => onChange({ strokeWidth: v })}
            />
          </Field>
          <Field label="Glow" hint={`${Math.round(style.shadowBlur * 100)}%`}>
            <Range
              value={style.shadowBlur}
              min={0}
              max={0.2}
              step={0.005}
              onChange={(v) => onChange({ shadowBlur: v })}
            />
          </Field>
        </div>
        <Field label="Background">
          <Select<CaptionBackgroundMode>
            value={style.backgroundMode}
            onChange={(v) => onChange({ backgroundMode: v })}
            options={[
              { value: 'none', label: 'None' },
              { value: 'line', label: 'Per-line pill' },
              { value: 'block', label: 'Single box' },
            ]}
          />
        </Field>
        <Field label="Background opacity" hint={`${Math.round(bgAlpha * 100)}%`}>
          <Range
            value={bgAlpha}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) =>
              onChange({ backgroundColor: hexToRgba(toHex(style.backgroundColor), v) })
            }
          />
        </Field>
        {bgAlpha > 0 && (
          <ColorField
            label="Background colour"
            value={style.backgroundColor}
            onChange={(v) =>
              onChange({ backgroundColor: hexToRgba(v, bgAlpha || 1) })
            }
          />
        )}
      </section>

      <section className="space-y-3 rounded-3xl border border-white/10 bg-black/20 p-3">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
          Position
        </h3>
        <Field label="Anchor">
          <Select<CaptionPosition>
            value={style.position}
            onChange={(v) => onChange({ position: v })}
            options={[
              { value: 'top', label: 'Top' },
              { value: 'center', label: 'Center' },
              { value: 'bottom', label: 'Bottom' },
            ]}
          />
        </Field>
        <Field label="Offset" hint={`${Math.round(style.marginY * 100)}%`}>
          <Range
            value={style.marginY}
            min={0.02}
            max={style.position === 'center' ? 0.95 : 0.45}
            step={0.01}
            onChange={(v) => onChange({ marginY: v })}
          />
        </Field>
      </section>
    </div>
  )
}
