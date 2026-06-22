import type { Cue, Word } from './types'
import { uid } from './id'

const GAP_THRESHOLD = 0.6 // seconds of silence that forces a new cue
const MAX_CUE_DURATION = 5 // never keep a cue on screen longer than this

/**
 * Group a flat list of timed words into on-screen cues.
 *
 * A new cue is started when any of the following is true:
 *  - the current cue already holds `maxWordsPerCue` words
 *  - there is a sizeable pause before the next word
 *  - keeping the cue would exceed `MAX_CUE_DURATION`
 *  - the previous word ended a sentence (., !, ?)
 */
export function buildCues(words: Word[], maxWordsPerCue: number): Cue[] {
  const cues: Cue[] = []
  let current: Word[] = []

  const flush = () => {
    if (current.length === 0) return
    cues.push({
      id: uid('cue'),
      words: current,
      start: current[0].start,
      end: current[current.length - 1].end,
    })
    current = []
  }

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const prev = current[current.length - 1]

    if (prev) {
      const gap = word.start - prev.end
      const cueDuration = word.end - current[0].start
      const endsSentence = /[.!?]["')\]]?$/.test(prev.text.trim())
      if (
        current.length >= maxWordsPerCue ||
        gap > GAP_THRESHOLD ||
        cueDuration > MAX_CUE_DURATION ||
        endsSentence
      ) {
        flush()
      }
    }

    current.push(word)
  }
  flush()

  return cues
}

/** Find the cue that should be visible at time `t`, or null. */
export function activeCueAt(cues: Cue[], t: number): Cue | null {
  // A small lead-in keeps captions feeling responsive.
  for (const cue of cues) {
    if (t >= cue.start && t <= cue.end + 0.15) return cue
  }
  return null
}

/** Distribute timings evenly across words of a plain text string. */
export function wordsFromText(
  text: string,
  start: number,
  end: number,
): Word[] {
  const tokens = text
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
  if (tokens.length === 0) return []
  const dur = Math.max(0.1, end - start)
  const per = dur / tokens.length
  return tokens.map((text, i) => ({
    id: uid('w'),
    text,
    start: start + i * per,
    end: start + (i + 1) * per,
  }))
}
