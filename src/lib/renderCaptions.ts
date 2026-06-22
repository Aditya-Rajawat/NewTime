import type { CaptionStyle, Cue, Word } from './types'

export interface DrawArgs {
  cue: Cue | null
  time: number
  style: CaptionStyle
  width: number
  height: number
}

const EMOJI_RE = /\p{Extended_Pictographic}/u
const LETTER_RE = /\p{L}/u

function applyTransform(text: string, style: CaptionStyle): string {
  if (style.textTransform === 'uppercase') return text.toUpperCase()
  if (style.textTransform === 'lowercase') return text.toLowerCase()
  return text
}

function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

interface LaidWord {
  word: Word
  display: string
  width: number
  isEmoji: boolean
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, h / 2, w / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/**
 * Draw the caption for a single frame. The caller is responsible for having
 * already painted the video frame (export) or cleared the canvas (preview).
 */
export function drawCaptionFrame(
  ctx: CanvasRenderingContext2D,
  { cue, time, style, width, height }: DrawArgs,
): void {
  if (!cue || cue.words.length === 0) return

  const fontPx = Math.max(8, style.fontSize * height)
  const lineHeightPx = fontPx * style.lineHeight
  const spacePx = fontPx * 0.28
  const fontString = `${style.fontWeight} ${fontPx}px ${style.fontFamily}`

  ctx.save()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = fontString
  if ('letterSpacing' in ctx) {
    ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${
      style.letterSpacing * fontPx
    }px`
  }

  // --- Measure + wrap words into lines ---
  const maxLineWidth = width * 0.9
  const laid: LaidWord[] = cue.words.map((word) => {
    const display = applyTransform(word.text, style)
    return {
      word,
      display,
      width: ctx.measureText(display).width,
      isEmoji: EMOJI_RE.test(word.text) && !LETTER_RE.test(word.text),
    }
  })

  const lines: LaidWord[][] = []
  let line: LaidWord[] = []
  let lineWidth = 0
  for (const lw of laid) {
    const add = lw.width + (line.length > 0 ? spacePx : 0)
    if (line.length > 0 && lineWidth + add > maxLineWidth) {
      lines.push(line)
      line = []
      lineWidth = 0
    }
    line.push(lw)
    lineWidth += lw.width + (line.length > 1 ? spacePx : 0)
  }
  if (line.length > 0) lines.push(line)

  const blockHeight = lines.length * lineHeightPx

  // --- Vertical placement ---
  let blockTop: number
  if (style.position === 'top') {
    blockTop = height * style.marginY
  } else if (style.position === 'bottom') {
    blockTop = height - height * style.marginY - blockHeight
  } else {
    blockTop = (height - blockHeight) / 2 + (style.marginY - 0.5) * height
  }
  blockTop = Math.max(
    height * 0.02,
    Math.min(blockTop, height * 0.98 - blockHeight),
  )

  // --- Entrance animation (whole cue) ---
  const sinceStart = time - cue.start
  let cueAlpha = 1
  let cueScale = 1
  let cueOffsetY = 0
  const ENTER = 0.22
  if (style.entrance !== 'none' && style.entrance !== 'word-by-word') {
    const p = clamp01(sinceStart / ENTER)
    if (style.entrance === 'fade') {
      cueAlpha = p
    } else if (style.entrance === 'pop') {
      cueScale = 0.7 + 0.3 * easeOutBack(p)
      cueAlpha = p
    } else if (style.entrance === 'slide-up') {
      cueOffsetY = (1 - p) * fontPx * 0.8
      cueAlpha = p
    }
  }

  ctx.globalAlpha = cueAlpha
  const centerX = width / 2
  const centerY = blockTop + blockHeight / 2 + cueOffsetY
  ctx.translate(centerX, centerY)
  ctx.scale(cueScale, cueScale)
  ctx.translate(-centerX, -centerY)

  const lineWidths = lines.map(
    (lineWords) =>
      lineWords.reduce((sum, lw) => sum + lw.width, 0) +
      spacePx * (lineWords.length - 1),
  )
  const hasBg = Boolean(style.backgroundColor) && !style.backgroundColor.endsWith(',0)')
  const bgPad = style.backgroundPadding * height
  const leading = (lineHeightPx - fontPx) / 2

  // --- Unified "block" background behind the whole cue (broadcast / Premiere) ---
  if (hasBg && style.backgroundMode === 'block') {
    const maxWidth = Math.max(...lineWidths, 0)
    const textTop = blockTop + leading + cueOffsetY
    const textBottom = blockTop + blockHeight - leading + cueOffsetY
    ctx.fillStyle = style.backgroundColor
    roundRect(
      ctx,
      centerX - maxWidth / 2 - bgPad,
      textTop - bgPad,
      maxWidth + bgPad * 2,
      textBottom - textTop + bgPad * 2,
      style.backgroundRadius * height,
    )
    ctx.fill()
  }

  // --- Draw each line ---
  lines.forEach((lineWords, li) => {
    const totalWidth = lineWidths[li]
    let x = centerX - totalWidth / 2
    const yBaseline = blockTop + li * lineHeightPx + lineHeightPx / 2 + cueOffsetY

    // Optional pill background behind each individual line.
    if (hasBg && style.backgroundMode === 'line') {
      ctx.fillStyle = style.backgroundColor
      roundRect(
        ctx,
        x - bgPad,
        yBaseline - lineHeightPx / 2 + leading - bgPad * 0.4,
        totalWidth + bgPad * 2,
        fontPx + bgPad * 0.8,
        style.backgroundRadius * height,
      )
      ctx.fill()
    }

    for (const lw of lineWords) {
      const active = time >= lw.word.start && time < lw.word.end
      drawWord(ctx, lw, x, yBaseline, {
        style,
        fontPx,
        active,
        time,
        cueStart: cue.start,
      })
      x += lw.width + spacePx
    }
  })

  ctx.restore()
}

interface WordDrawCtx {
  style: CaptionStyle
  fontPx: number
  active: boolean
  time: number
  cueStart: number
}

function drawWord(
  ctx: CanvasRenderingContext2D,
  lw: LaidWord,
  x: number,
  yBaseline: number,
  { style, fontPx, active, time, cueStart }: WordDrawCtx,
) {
  let scale = 1
  let alpha = 1

  // Per-word entrance for "word-by-word".
  if (style.entrance === 'word-by-word') {
    const p = clamp01((time - lw.word.start + 0.12) / 0.2)
    scale *= 0.6 + 0.4 * easeOutBack(p)
    alpha *= clamp01((time - lw.word.start + 0.12) / 0.12)
    if (time < cueStart) alpha = 0
  }

  // "reveal": words brighten as they are spoken; upcoming words stay dimmed.
  if (style.activeWordEffect === 'reveal') {
    const spoken = time >= lw.word.start - 0.04
    alpha *= spoken ? 1 : 0.42
  }

  if (active && style.activeWordEffect === 'scale') scale *= 1.18
  if (lw.isEmoji && style.emojiBoost) scale *= 1.25

  const cx = x + lw.width / 2
  const cy = yBaseline

  ctx.save()
  ctx.globalAlpha *= alpha
  if (scale !== 1) {
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.translate(-cx, -cy)
  }

  // Highlight box behind the active word.
  if (active && style.activeWordEffect === 'highlight') {
    const pad = fontPx * 0.14
    ctx.fillStyle = style.highlightColor
    roundRect(
      ctx,
      x - pad,
      cy - fontPx * 0.62,
      lw.width + pad * 2,
      fontPx * 1.24,
      fontPx * 0.18,
    )
    ctx.fill()
  }

  // Soft shadow / glow.
  if (style.shadowBlur > 0) {
    ctx.shadowColor = style.shadowColor
    ctx.shadowBlur = style.shadowBlur * fontPx
  }

  // Stroke (outline) for legibility.
  if (style.strokeWidth > 0) {
    ctx.lineWidth = style.strokeWidth * fontPx
    ctx.strokeStyle = style.strokeColor
    ctx.lineJoin = 'round'
    ctx.miterLimit = 2
    ctx.strokeText(lw.display, x, cy)
  }

  // Fill.
  ctx.shadowBlur = 0
  if (active && style.activeWordEffect === 'color') {
    ctx.fillStyle = style.activeColor
  } else if (active && style.activeWordEffect === 'highlight') {
    ctx.fillStyle = '#ffffff'
  } else {
    ctx.fillStyle = style.textColor
  }
  ctx.fillText(lw.display, x, cy)

  ctx.restore()
}
