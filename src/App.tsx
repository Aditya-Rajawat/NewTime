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

const TRUST_ITEMS = ['Free forever', 'No watermark', 'Runs in your browser']

const LANDING_STATS = [
  { value: '0$', label: 'subscription required' },
  { value: '100%', label: 'local private workflow' },
  { value: '9:16', label: 'short-form optimized' },
]

const EDITOR_STEPS = [
  { label: 'Upload', detail: 'Clip ready' },
  { label: 'Caption', detail: 'AI or script' },
  { label: 'Design', detail: 'Templates' },
  { label: 'Export', detail: 'No watermark' },
]

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
    <div className="relative flex h-full min-h-screen flex-col overflow-hidden bg-[#05050a]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-[-18rem] h-[38rem] w-[38rem] rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute right-[-12rem] top-20 h-[34rem] w-[34rem] rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute bottom-[-18rem] left-1/3 h-[32rem] w-[32rem] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="noise-layer absolute inset-0 opacity-[0.18]" />
      </div>

      <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/20 px-5 py-3 backdrop-blur-xl">
        <BrandLockup />
        <nav className="hidden items-center gap-6 text-sm font-medium text-white/55 md:flex">
          <a className="transition hover:text-white" href="#templates">
            Templates
          </a>
          <a className="transition hover:text-white" href="#workflow">
            Workflow
          </a>
          <a className="transition hover:text-white" href="#privacy">
            Privacy
          </a>
        </nav>
        {file && (
          <button
            onClick={newProject}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75 shadow-lg shadow-black/20 transition hover:bg-white/10"
          >
            New project
          </button>
        )}
        {!file && (
          <div className="hidden rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-200 sm:block">
            100% free
          </div>
        )}
      </header>

      {!file ? (
        <main className="relative z-10 flex flex-1 overflow-y-auto">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-5 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 xl:py-16">
            <section className="text-center lg:text-left">
              <div className="mb-6 flex flex-wrap justify-center gap-2 lg:justify-start">
                {TRUST_ITEMS.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/65 backdrop-blur"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <h2 className="mx-auto max-w-4xl text-5xl font-black leading-[0.93] tracking-[-0.06em] text-white sm:text-6xl lg:mx-0 xl:text-7xl">
                Create viral captions for every short video.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/60 lg:mx-0">
                Auto-transcribe, edit word-level timing, design animated caption
                templates, and export a ready-to-post video without accounts,
                paywalls, or watermarks.
              </p>
              <div className="mt-8 grid grid-cols-3 gap-3">
                {LANDING_STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur"
                  >
                    <p className="text-2xl font-black text-white">{stat.value}</p>
                    <p className="mt-1 text-xs font-medium text-white/45">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
              <FeatureStrip />
            </section>

            <section className="relative">
              <HeroPreview />
              <Uploader onFile={handleFile} />
            </section>
          </div>
        </main>
      ) : (
        <main className="relative z-10 grid flex-1 grid-cols-1 gap-4 overflow-hidden p-3 lg:grid-cols-[minmax(0,1fr)_430px] lg:p-4">
          {/* Left: preview + transcription/export toolbar */}
          <div className="flex min-h-0 flex-col gap-3">
            <div className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-3 shadow-2xl shadow-black/30 backdrop-blur-xl xl:grid-cols-[1fr_auto]">
              <div className="grid gap-2 sm:grid-cols-4" id="workflow">
                {EDITOR_STEPS.map((step, index) => (
                  <div
                    key={step.label}
                    className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-200/70">
                      0{index + 1}
                    </p>
                    <p className="mt-1 text-sm font-bold text-white">{step.label}</p>
                    <p className="text-xs text-white/40">{step.detail}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={busy}
                  className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white outline-none focus:border-fuchsia-400/60"
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
                  className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-black text-white shadow-lg shadow-fuchsia-500/25 transition hover:scale-[1.02] hover:opacity-95 disabled:scale-100 disabled:opacity-50"
                >
                  {busy ? 'Working...' : words.length ? 'Re-caption' : 'Auto-caption'}
                </button>
                <button
                  onClick={() => setScriptOpen((v) => !v)}
                  className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-bold text-white/75 transition hover:bg-white/10"
                >
                  Type script
                </button>
                {exStatus.state === 'recording' ||
                exStatus.state === 'finalizing' ? (
                  <button
                    onClick={cancelExport}
                    className="rounded-full border border-red-400/40 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/10"
                  >
                    Cancel export
                  </button>
                ) : (
                  <button
                    onClick={handleExport}
                    disabled={cues.length === 0}
                    className="rounded-full bg-white px-4 py-2 text-sm font-black text-black shadow-lg shadow-white/10 transition hover:scale-[1.02] hover:bg-white/90 disabled:scale-100 disabled:opacity-40"
                  >
                    Export video
                  </button>
                )}
              </div>
            </div>

            {scriptOpen && (
              <div className="animate-float-up rounded-[1.5rem] border border-white/10 bg-black/35 p-4 shadow-xl shadow-black/20 backdrop-blur-xl">
                <p className="mb-3 text-sm text-white/60">
                  Paste a script. Each line becomes a phrase, timing is spread
                  across the clip, and you can fine-tune every word in the
                  Captions tab.
                </p>
                <textarea
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  rows={4}
                  placeholder={'Wait for it...\nThis changes everything\nFollow for part two'}
                  className="w-full resize-y rounded-2xl border border-white/10 bg-black/45 p-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-fuchsia-400/60"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setScriptOpen(false)}
                    className="rounded-full px-4 py-2 text-sm font-bold text-white/60 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={applyScript}
                    className="rounded-full bg-fuchsia-500 px-4 py-2 text-sm font-black text-white hover:bg-fuchsia-400"
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
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="border-b border-white/10 p-3">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-1">
                {(['captions', 'style'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`w-1/2 rounded-xl px-4 py-2.5 text-sm font-black capitalize transition ${
                    tab === t
                      ? 'bg-white text-black shadow-lg shadow-white/10'
                      : 'text-white/45 hover:text-white/70'
                  }`}
                >
                  {t === 'style' ? 'Templates' : 'Captions'}
                </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === 'style' ? (
                <div className="p-4" id="templates">
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

function BrandLockup() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sm font-black text-black shadow-lg shadow-fuchsia-500/20">
        <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-400 via-fuchsia-400 to-cyan-300 opacity-90" />
        <span className="relative text-white drop-shadow">FC</span>
      </div>
      <div className="leading-tight">
        <h1 className="text-sm font-black tracking-tight text-white">
          FreeCaption Studio
        </h1>
        <p className="text-[11px] font-medium text-white/45">
          AI captions for Reels, Shorts and TikTok
        </p>
      </div>
    </div>
  )
}

function FeatureStrip() {
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-3">
      {[
        ['Word-level editing', 'Fix text and timing inline.'],
        ['Template presets', 'Switch between creator-ready looks.'],
        ['Private exports', 'Render locally in your browser.'],
      ].map(([title, body]) => (
        <div
          key={title}
          className="rounded-3xl border border-white/10 bg-black/25 p-4 text-left backdrop-blur"
        >
          <div className="mb-3 h-1.5 w-10 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" />
          <p className="text-sm font-black text-white">{title}</p>
          <p className="mt-1 text-sm leading-6 text-white/50">{body}</p>
        </div>
      ))}
    </div>
  )
}

function HeroPreview() {
  return (
    <div className="pointer-events-none absolute -right-1 top-0 hidden w-64 rotate-3 rounded-[2.4rem] border border-white/10 bg-[#11111b] p-3 shadow-2xl shadow-fuchsia-950/40 lg:block xl:-right-8">
      <div className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-gradient-to-br from-[#232346] via-[#0d1020] to-[#111111]">
        <div className="flex h-[30rem] flex-col justify-end bg-[radial-gradient(circle_at_50%_18%,rgba(244,114,182,0.34),transparent_35%),radial-gradient(circle_at_10%_68%,rgba(34,211,238,0.22),transparent_28%)] p-4">
          <div className="mb-10 space-y-2 text-center">
            <p className="inline-block rounded-xl bg-black/70 px-3 py-2 text-3xl font-black leading-none text-white shadow-lg">
              CREATE
            </p>
            <p className="inline-block rounded-xl bg-fuchsia-500 px-3 py-2 text-3xl font-black leading-none text-white shadow-lg">
              CAPTIONS
            </p>
            <p className="mx-auto max-w-[11rem] rounded-full bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-black">
              free export
            </p>
          </div>
        </div>
      </div>
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
    return <Bar tone="info">Finalizing file...</Bar>
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
      className={`flex items-center rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-lg shadow-black/20 ${toneClass}`}
    >
      {children}
    </div>
  )
}
