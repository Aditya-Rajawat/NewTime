import { useState } from 'react'
import type { Cue, Word } from '../lib/types'
import { formatTime } from '../lib/format'

interface Props {
  words: Word[]
  cues: Cue[]
  currentTime: number
  onChangeWords: (words: Word[]) => void
  onSeek: (t: number) => void
}

export default function TranscriptEditor({
  words,
  cues,
  currentTime,
  onChangeWords,
  onSeek,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null)

  const updateWord = (id: string, patch: Partial<Word>) => {
    onChangeWords(words.map((w) => (w.id === id ? { ...w, ...patch } : w)))
  }

  const deleteWord = (id: string) => {
    onChangeWords(words.filter((w) => w.id !== id))
  }

  const shiftAll = (delta: number) => {
    onChangeWords(
      words.map((w) => ({
        ...w,
        start: Math.max(0, w.start + delta),
        end: Math.max(0.05, w.end + delta),
      })),
    )
  }

  const nudge = (w: Word, deltaStart: number, deltaEnd: number) => {
    updateWord(w.id, {
      start: Math.max(0, w.start + deltaStart),
      end: Math.max(w.start + 0.05, w.end + deltaEnd),
    })
  }

  if (words.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div className="max-w-xs rounded-3xl border border-white/10 bg-black/25 p-6">
          <p className="text-lg font-black text-white">No captions yet</p>
          <p className="mt-2 text-sm leading-6 text-white/45">
            Run auto-captioning or type your script to create editable
            word-level captions.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
          {words.length} words · {cues.length} cues
        </span>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs font-bold text-white/40">Sync</span>
          <button
            onClick={() => shiftAll(-0.1)}
            className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold hover:bg-white/20"
            title="Shift all captions 0.1s earlier"
          >
            −0.1s
          </button>
          <button
            onClick={() => shiftAll(0.1)}
            className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold hover:bg-white/20"
            title="Shift all captions 0.1s later"
          >
            +0.1s
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {cues.map((cue) => {
          const cueActive =
            currentTime >= cue.start && currentTime <= cue.end + 0.15
          return (
            <div
              key={cue.id}
              className={`rounded-2xl border p-3 transition ${
                cueActive
                  ? 'border-fuchsia-300/50 bg-fuchsia-500/10 shadow-lg shadow-fuchsia-950/20'
                  : 'border-white/10 bg-black/20'
              }`}
            >
              <button
                onClick={() => onSeek(cue.start)}
                className="mb-1.5 font-mono text-[11px] text-white/40 hover:text-fuchsia-300"
              >
                {formatTime(cue.start)}
              </button>
              <div className="flex flex-wrap items-center gap-1.5">
                {cue.words.map((w) => {
                  const active =
                    currentTime >= w.start && currentTime < w.end
                  const isSel = selected === w.id
                  return (
                    <span key={w.id} className="group relative inline-flex">
                      <input
                        value={w.text}
                        onChange={(e) =>
                          updateWord(w.id, { text: e.target.value })
                        }
                        onFocus={() => {
                          setSelected(w.id)
                          onSeek(w.start)
                        }}
                        style={{
                          width: `${Math.max(2, w.text.length + 1)}ch`,
                        }}
                        className={`rounded-xl border px-2 py-1.5 text-center text-sm font-semibold outline-none transition ${
                          active
                            ? 'border-fuchsia-300 bg-fuchsia-500/25 text-white'
                            : isSel
                              ? 'border-white/40 bg-white/10 text-white'
                              : 'border-transparent bg-white/[0.06] text-white/80 hover:bg-white/10'
                        }`}
                      />
                      <button
                        onClick={() => deleteWord(w.id)}
                        className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] leading-none text-white group-hover:flex"
                        aria-label={`Delete "${w.text}"`}
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
              </div>

              {selected &&
                cue.words.some((w) => w.id === selected) &&
                (() => {
                  const w = cue.words.find((x) => x.id === selected)!
                  return (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-[11px] text-white/50">
                      <span className="font-mono">
                        {formatTime(w.start)} → {formatTime(w.end)}
                      </span>
                      <div className="ml-auto flex items-center gap-1">
                        <span>start</span>
                        <button
                          onClick={() => nudge(w, -0.05, 0)}
                          className="rounded-full bg-white/10 px-2 py-0.5 hover:bg-white/20"
                        >
                          −
                        </button>
                        <button
                          onClick={() => nudge(w, 0.05, 0)}
                          className="rounded-full bg-white/10 px-2 py-0.5 hover:bg-white/20"
                        >
                          +
                        </button>
                        <span className="ml-1">end</span>
                        <button
                          onClick={() => nudge(w, 0, -0.05)}
                          className="rounded-full bg-white/10 px-2 py-0.5 hover:bg-white/20"
                        >
                          −
                        </button>
                        <button
                          onClick={() => nudge(w, 0, 0.05)}
                          className="rounded-full bg-white/10 px-2 py-0.5 hover:bg-white/20"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })()}
            </div>
          )
        })}
      </div>
    </div>
  )
}
