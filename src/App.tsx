import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Uploader from './components/Uploader'
import PreviewStage from './components/PreviewStage'
import StylePanel from './components/StylePanel'
import TranscriptEditor from './components/TranscriptEditor'
import type {
  CaptionStyle,
  ExportStatus,
  TranscriptionStatus,
  Word,
} from './lib/types'
import { DEFAULT_STYLE, PRESETS } from './lib/presets'
import { buildCues, wordsFromText } from './lib/cues'
import {
  createTranscriber,
  decodeAudio,
  WHISPER_MODELS,
  type Transcriber,
} from './lib/transcribe'
import { exportCaptionedVideo } from './lib/exportVideo'
import { formatBytes } from './lib/format'

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [words, setWords] = useState<Word[]>([])
  const [style, setStyle] = useState<CaptionStyle>({ ...DEFAULT_STYLE })
  const [activePresetId, setActivePresetId] = useState<string | null>(PRESETS[0].id)
  const [model, setModel] = useState(WHISPER_MODELS[0].value)

  const [trStatus, setTrStatus] = useState<TranscriptionStatus>({ state: 'idle' })
  const [exStatus, setExStatus] = useState<ExportStatus>({ state: 'idle' })

  const [tab, setTab] = useState<'style' | 'captions'>('captions')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [scriptOpen, setScriptOpen] = useState(false)
  const [scriptText, setScriptText] = useState('')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const transcriberRef = useRef<Transcriber | null>(null)
  const exportAbort = useRef<AbortController | null>(null)

  const cues = useMemo(
    () => buildCues(words, style.maxWordsPerCue),
    [words, style.maxWordsPerCue],
  )

  useEffect(() => {
    return () => {
      transcriberRef.current?.dispose()
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
  }, [videoUrl])

  const handleFile = useCallback(
    (f: File) => {
      setVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(f)
      })
      setFile(f)
      setWords([])
      setTrStatus({ state: 'idle' })
      setExStatus({ state: 'idle' })
      setCurrentTime(0)
    },
    [],
  )

  const runTranscription = useCallback(async () => {
    if (!file) return
    try {
      setTrStatus({
        state: 'loading-model',
        message: 'Preparing model…',
        progress: 0,
      })
      setExStatus({ state: 'idle' })
      const audio = await decodeAudio(file)
      if (!transcriberRef.current) transcriberRef.current = createTranscriber()
      const isEnglishOnly = model.endsWith('.en')
      const result = await transcriberRef.current.run(
        audio,
        model,
        isEnglishOnly ? undefined : 'en',
        {
          onModelProgress: (message, progress) =>
            setTrStatus({ state: 'loading-model', message, progress }),
          onStatus: (message) =>
            setTrStatus({ state: 'transcribing', message, progress: 0 }),
        },
      )
      setWords(result)
      setTrStatus({ state: 'done' })
      setTab('captions')
    } catch (err) {
      setTrStatus({
        state: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }, [file, model])

  const applyScript = useCallback(() => {
    const dur = duration || videoRef.current?.duration || 10
    const lines = scriptText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) return
    const totalWords = lines.reduce(
      (n, l) => n + l.split(/\s+/).filter(Boolean).length,
      0,
    )
    const all: Word[] = []
    let cursor = 0
    for (const line of lines) {
      const count = line.split(/\s+/).filter(Boolean).length
      const span = (count / totalWords) * dur
      all.push(...wordsFromText(line, cursor, cursor + span))
      cursor += span
    }
    setWords(all)
    setScriptOpen(false)
    setTab('captions')
  }, [scriptText, duration])

  const handleSelectPreset = useCallback(
    (preset: (typeof PRESETS)[number]) => {
      setStyle({ ...preset.style })
      setActivePresetId(preset.id)
    },
    [],
  )

  const handleStyleChange = useCallback((patch: Partial<CaptionStyle>) => {
    setStyle((s) => ({ ...s, ...patch }))
    setActivePresetId(null)
  }, [])

  const seek = useCallback((t: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = t
      setCurrentTime(t)
    }
  }, [])

  const handleExport = useCallback(async () => {
    if (!videoUrl || cues.length === 0) return
    const controller = new AbortController()
    exportAbort.current = controller
    if (videoRef.current) videoRef.current.pause()
    setExStatus({ state: 'recording', progress: 0 })
    try {
      const result = await exportCaptionedVideo({
        videoUrl,
        cues,
        style,
        signal: controller.signal,
        onProgress: (f) => setExStatus({ state: 'recording', progress: f }),
      })
      setExStatus({ state: 'finalizing' })
      const url = URL.createObjectURL(result.blob)
      setExStatus({ state: 'done', url, size: result.blob.size })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setExStatus({ state: 'idle' })
      } else {
        setExStatus({
          state: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      }
    } finally {
      exportAbort.current = null
    }
  }, [videoUrl, cues, style])

  const cancelExport = useCallback(() => {
    exportAbort.current?.abort()
  }, [])

  const newProject = useCallback(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    if (exStatus.state === 'done') URL.revokeObjectURL(exStatus.url)
    setFile(null)
    setVideoUrl('')
    setWords([])
    setTrStatus({ state: 'idle' })
    setExStatus({ state: 'idle' })
  }, [videoUrl, exStatus])

  const exportBaseName = file
    ? file.name.replace(/\.[^.]+$/, '')
    : 'newtime-captions'

  const busy =
    trStatus.state === 'loading-model' || trStatus.state === 'transcribing'

  return (
    <div className="flex h-full min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-black text-white">
            CC
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-bold text-white">NewTime Captions</h1>
            <p className="text-[11px] text-white/45">
              Dynamic captions for Reels, Shorts & TikTok
            </p>
          </div>
        </div>
        {file && (
          <button
            onClick={newProject}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10"
          >
            New project
          </button>
        )}
      </header>

      {!file ? (
        <main className="flex flex-1 items-center justify-center">
          <div className="w-full">
            <div className="mx-auto max-w-2xl px-6 pt-8 text-center">
              <h2 className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
                Caption your short-form video in seconds
              </h2>
              <p className="mt-3 text-white/55">
                Auto-transcribe, style word-by-word animated captions, and export
                a ready-to-post video — all in your browser.
              </p>
            </div>
            <Uploader onFile={handleFile} />
          </div>
        </main>
      ) : (
        <main className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[1fr_400px]">
          {/* Left: preview + transcription/export toolbar */}
          <div className="flex min-h-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
              <div className="flex items-center gap-1.5">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={busy}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white outline-none focus:border-fuchsia-400/60"
                >
                  {WHISPER_MODELS.map((m) => (
                    <option key={m.value} value={m.value} className="bg-[#15151f]">
                      {m.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={runTranscription}
                  disabled={busy}
                  className="rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? 'Working…' : words.length ? 'Re-caption' : 'Auto-caption'}
                </button>
              </div>
              <button
                onClick={() => setScriptOpen((v) => !v)}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/10"
              >
                Type script
              </button>

              <div className="ml-auto">
                {exStatus.state === 'recording' ||
                exStatus.state === 'finalizing' ? (
                  <button
                    onClick={cancelExport}
                    className="rounded-lg border border-red-400/40 px-3.5 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10"
                  >
                    Cancel export
                  </button>
                ) : (
                  <button
                    onClick={handleExport}
                    disabled={cues.length === 0}
                    className="rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-40"
                  >
                    Export video
                  </button>
                )}
              </div>
            </div>

            {scriptOpen && (
              <div className="animate-float-up rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="mb-2 text-xs text-white/55">
                  Paste your script. Each line becomes a phrase; timing is spread
                  evenly across the clip (then fine-tune in the Captions tab).
                </p>
                <textarea
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  rows={4}
                  placeholder={'Wait for it…\nThis changes everything\nFollow for part two'}
                  className="w-full resize-y rounded-lg border border-white/10 bg-black/30 p-2.5 text-sm text-white outline-none focus:border-fuchsia-400/60"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setScriptOpen(false)}
                    className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={applyScript}
                    className="rounded-lg bg-fuchsia-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-fuchsia-400"
                  >
                    Set captions
                  </button>
                </div>
              </div>
            )}

            <StatusBar
              trStatus={trStatus}
              exStatus={exStatus}
              exportBaseName={exportBaseName}
            />

            <div className="min-h-0 flex-1">
              <PreviewStage
                videoUrl={videoUrl}
                cues={cues}
                style={style}
                videoRef={videoRef}
                onTimeUpdate={setCurrentTime}
                onDuration={setDuration}
              />
            </div>
          </div>

          {/* Right: tabbed sidebar */}
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="flex border-b border-white/10">
              {(['captions', 'style'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 px-4 py-2.5 text-sm font-semibold capitalize transition ${
                    tab === t
                      ? 'border-b-2 border-fuchsia-400 text-white'
                      : 'text-white/45 hover:text-white/70'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === 'style' ? (
                <div className="p-4">
                  <StylePanel
                    style={style}
                    presets={PRESETS}
                    activePresetId={activePresetId}
                    onSelectPreset={handleSelectPreset}
                    onChange={handleStyleChange}
                  />
                </div>
              ) : (
                <TranscriptEditor
                  words={words}
                  cues={cues}
                  currentTime={currentTime}
                  onChangeWords={setWords}
                  onSeek={seek}
                />
              )}
            </div>
          </aside>
        </main>
      )}
    </div>
  )
}

function StatusBar({
  trStatus,
  exStatus,
  exportBaseName,
}: {
  trStatus: TranscriptionStatus
  exStatus: ExportStatus
  exportBaseName: string
}) {
  if (
    trStatus.state === 'loading-model' ||
    trStatus.state === 'transcribing'
  ) {
    const pct =
      trStatus.state === 'loading-model' ? Math.round(trStatus.progress) : null
    return (
      <Bar tone="info">
        <span>{trStatus.message}</span>
        {pct != null && (
          <div className="ml-3 h-1.5 w-32 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full bg-fuchsia-400 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </Bar>
    )
  }
  if (trStatus.state === 'error') {
    return <Bar tone="error">Transcription failed: {trStatus.message}</Bar>
  }
  if (exStatus.state === 'recording') {
    return (
      <Bar tone="info">
        <span>Rendering video… {Math.round(exStatus.progress * 100)}%</span>
        <div className="ml-3 h-1.5 w-32 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full bg-white transition-all"
            style={{ width: `${exStatus.progress * 100}%` }}
          />
        </div>
      </Bar>
    )
  }
  if (exStatus.state === 'finalizing') {
    return <Bar tone="info">Finalizing file…</Bar>
  }
  if (exStatus.state === 'done') {
    const ext = exStatus.url.includes('mp4') ? 'mp4' : 'webm'
    return (
      <Bar tone="success">
        <span>Done · {formatBytes(exStatus.size)}</span>
        <a
          href={exStatus.url}
          download={`${exportBaseName}-captioned.${ext}`}
          className="ml-3 rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-black hover:bg-emerald-400"
        >
          Download
        </a>
      </Bar>
    )
  }
  if (exStatus.state === 'error') {
    return <Bar tone="error">Export failed: {exStatus.message}</Bar>
  }
  return null
}

function Bar({
  tone,
  children,
}: {
  tone: 'info' | 'success' | 'error'
  children: React.ReactNode
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
      : tone === 'error'
        ? 'border-red-400/40 bg-red-500/10 text-red-200'
        : 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100'
  return (
    <div
      className={`flex items-center rounded-xl border px-3.5 py-2 text-sm ${toneClass}`}
    >
      {children}
    </div>
  )
}
