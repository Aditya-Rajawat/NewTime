/** A single spoken word with its timing, in seconds. */
export interface Word {
  id: string
  text: string
  start: number
  end: number
}

/**
 * A caption "cue": the group of words that are shown on screen together at a
 * given moment (e.g. 3-5 words for a punchy Reels-style caption).
 */
export interface Cue {
  id: string
  words: Word[]
  start: number
  end: number
}

export type CaptionPosition = 'top' | 'center' | 'bottom'

export type TextTransform = 'none' | 'uppercase' | 'lowercase'

/**
 * How the active word is emphasised while it is being spoken.
 * - highlight: a coloured box is drawn behind the active word
 * - color: the active word's text colour changes
 * - scale: the active word grows slightly
 * - reveal: words brighten as they are spoken (upcoming words dimmed) — the
 *           understated, professional "Premiere Pro" look
 * - none: no per-word emphasis (whole cue shown at once)
 */
export type ActiveWordEffect =
  | 'highlight'
  | 'color'
  | 'scale'
  | 'reveal'
  | 'none'

/**
 * How the caption's background is drawn:
 * - none: no background
 * - line: a separate rounded pill behind each line
 * - block: a single rounded box behind the whole cue (broadcast / Premiere look)
 */
export type CaptionBackgroundMode = 'none' | 'line' | 'block'

/** How a cue animates in. */
export type EntranceAnimation = 'none' | 'fade' | 'pop' | 'slide-up' | 'word-by-word'

export interface CaptionStyle {
  fontFamily: string
  fontWeight: number
  fontSize: number // as a fraction of video height (e.g. 0.06 = 6%)
  textColor: string
  activeColor: string
  highlightColor: string
  strokeColor: string
  strokeWidth: number // as a fraction of font size
  backgroundColor: string // cue background, supports rgba
  backgroundMode: CaptionBackgroundMode
  backgroundPadding: number // px-ish, scaled to video
  backgroundRadius: number
  position: CaptionPosition
  marginY: number // distance from top/bottom as a fraction of video height
  textTransform: TextTransform
  letterSpacing: number
  lineHeight: number
  maxWordsPerCue: number
  activeWordEffect: ActiveWordEffect
  entrance: EntranceAnimation
  shadowBlur: number
  shadowColor: string
  emojiBoost: boolean
}

export interface StylePreset {
  id: string
  name: string
  description: string
  style: CaptionStyle
}

export type TranscriptionStatus =
  | { state: 'idle' }
  | { state: 'loading-model'; message: string; progress: number }
  | { state: 'transcribing'; message: string; progress: number }
  | { state: 'done' }
  | { state: 'error'; message: string }

export type ExportStatus =
  | { state: 'idle' }
  | { state: 'recording'; progress: number }
  | { state: 'finalizing' }
  | { state: 'done'; url: string; size: number }
  | { state: 'error'; message: string }
