import { useEffect, useRef, useState, type RefObject } from 'react'
import type { CaptionStyle, Cue } from '../lib/types'
import { activeCueAt } from '../lib/cues'
import { drawCaptionFrame } from '../lib/renderCaptions'
import { formatTime } from '../lib/format'

interface Props {
  videoUrl: string
  cues: Cue[]
  style: CaptionStyle
  videoRef: RefObject<HTMLVideoElement | null>
  onTimeUpdate: (t: number) => void
  onDuration: (d: number) => void
}

export default function PreviewStage({
  videoUrl,
  cues,
  style,
  videoRef,
  onTimeUpdate,
  onDuration,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Keep refs current for the animation loop without re-subscribing.
  const cuesRef = useRef(cues)
  const styleRef = useRef(style)
  cuesRef.current = cues
  styleRef.current = style

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    let raf = 0

    const draw = () => {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        if (
          canvas.width !== video.videoWidth ||
          canvas.height !== video.videoHeight
        ) {
          if (video.videoWidth) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
          }
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const t = video.currentTime
        const cue = activeCueAt(cuesRef.current, t)
        drawCaptionFrame(ctx, {
          cue,
          time: t,
          style: styleRef.current,
          width: canvas.width,
          height: canvas.height,
        })
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [videoRef])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTime = () => {
      setTime(video.currentTime)
      onTimeUpdate(video.currentTime)
    }
    const onMeta = () => {
      setDuration(video.duration)
      onDuration(video.duration)
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    if (video.readyState >= 1) onMeta()
    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
    }
  }, [videoRef, onTimeUpdate, onDuration])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play()
    else video.pause()
  }

  const seek = (t: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = t
    setTime(t)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#07070d] p-4 shadow-2xl shadow-black/40">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.18),transparent_34%),radial-gradient(circle_at_16%_84%,rgba(34,211,238,0.14),transparent_26%)]" />
        <div className="absolute left-4 top-4 hidden rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white/50 backdrop-blur sm:block">
          Preview
        </div>
        <div className="absolute right-4 top-4 hidden rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200 sm:block">
          Free export
        </div>
        <div className="relative inline-flex max-h-[70vh] items-center justify-center rounded-[2.1rem] border border-white/10 bg-[#141420] p-2 shadow-2xl shadow-black/50">
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 h-1.5 w-14 -translate-x-1/2 rounded-full bg-black/55" />
          <video
            ref={videoRef}
            src={videoUrl}
            muted={muted}
            playsInline
            onClick={togglePlay}
            className="max-h-[70vh] w-auto max-w-full rounded-[1.6rem]"
          />
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-[1.6rem]"
          />
          {!playing && (
            <button
              onClick={togglePlay}
              className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-2xl text-white shadow-2xl backdrop-blur transition hover:scale-105 hover:bg-black/75"
              aria-label="Play"
            >
              ▶
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-[1.4rem] border border-white/10 bg-white/[0.045] px-3 py-2 shadow-xl shadow-black/20 backdrop-blur-xl">
        <button
          onClick={togglePlay}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-black transition hover:scale-105 hover:bg-white/90"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <span className="w-12 shrink-0 text-right font-mono text-xs text-white/60">
          {formatTime(time)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={time}
          onChange={(e) => seek(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer"
        />
        <span className="w-12 shrink-0 font-mono text-xs text-white/60">
          {formatTime(duration)}
        </span>
        <button
          onClick={() => setMuted((m) => !m)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm transition hover:bg-white/20"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  )
}
