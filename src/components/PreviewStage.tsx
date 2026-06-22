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
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black p-3">
        <div className="relative inline-flex max-h-[70vh] items-center justify-center">
          <video
            ref={videoRef}
            src={videoUrl}
            muted={muted}
            playsInline
            onClick={togglePlay}
            className="max-h-[70vh] w-auto max-w-full rounded-xl"
          />
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full rounded-xl"
          />
          {!playing && (
            <button
              onClick={togglePlay}
              className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl text-white backdrop-blur transition hover:bg-black/70"
              aria-label="Play"
            >
              ▶
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
        <button
          onClick={togglePlay}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sm text-white hover:bg-white/20"
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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sm hover:bg-white/20"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  )
}
