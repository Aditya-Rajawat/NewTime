import type { CaptionStyle, Cue } from './types'
import { activeCueAt } from './cues'
import { drawCaptionFrame } from './renderCaptions'

export interface ExportOptions {
  videoUrl: string
  cues: Cue[]
  style: CaptionStyle
  fps?: number
  maxWidth?: number
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

export interface ExportResult {
  blob: Blob
  mimeType: string
  extension: string
}

function pickMimeType(): { mimeType: string; extension: string } {
  const candidates = [
    { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', extension: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
  ]
  for (const c of candidates) {
    if (
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported(c.mimeType)
    ) {
      return c
    }
  }
  return { mimeType: 'video/webm', extension: 'webm' }
}

/**
 * Render the video with burned-in captions in real time and record the result.
 * Works fully client-side using a canvas capture stream + MediaRecorder.
 */
export async function exportCaptionedVideo(
  opts: ExportOptions,
): Promise<ExportResult> {
  const { videoUrl, cues, style, fps = 30, maxWidth = 1080 } = opts

  const video = document.createElement('video')
  video.src = videoUrl
  video.crossOrigin = 'anonymous'
  video.muted = false
  video.playsInline = true
  video.preload = 'auto'

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('Could not load the video for export.'))
  })

  const scale = Math.min(1, maxWidth / video.videoWidth)
  const width = Math.round((video.videoWidth * scale) / 2) * 2
  const height = Math.round((video.videoHeight * scale) / 2) * 2

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Canvas 2D context unavailable.')

  // Build the output stream: canvas video + element audio (via Web Audio).
  const canvasStream = canvas.captureStream(fps)
  const outStream = new MediaStream()
  canvasStream.getVideoTracks().forEach((t) => outStream.addTrack(t))

  let audioCtx: AudioContext | null = null
  try {
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    audioCtx = new AudioCtor()
    await audioCtx.resume()
    const srcNode = audioCtx.createMediaElementSource(video)
    const dest = audioCtx.createMediaStreamDestination()
    srcNode.connect(dest)
    dest.stream.getAudioTracks().forEach((t) => outStream.addTrack(t))
  } catch {
    // No audio track / unsupported — export silent video rather than failing.
  }

  const { mimeType, extension } = pickMimeType()
  const recorder = new MediaRecorder(outStream, {
    mimeType,
    videoBitsPerSecond: 10_000_000,
    audioBitsPerSecond: 128_000,
  })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  const duration = video.duration && isFinite(video.duration) ? video.duration : 0

  const cleanup = () => {
    outStream.getTracks().forEach((t) => t.stop())
    if (audioCtx) void audioCtx.close()
    video.remove()
  }

  return new Promise<ExportResult>((resolve, reject) => {
    let rafId = 0
    let aborted = false

    const stopAll = () => {
      cancelAnimationFrame(rafId)
      if (recorder.state !== 'inactive') recorder.stop()
    }

    opts.signal?.addEventListener('abort', () => {
      aborted = true
      stopAll()
    })

    recorder.onstop = () => {
      cleanup()
      if (aborted) {
        reject(new DOMException('Export cancelled', 'AbortError'))
        return
      }
      resolve({ blob: new Blob(chunks, { type: mimeType }), mimeType, extension })
    }
    recorder.onerror = () => {
      cleanup()
      reject(new Error('Recording failed.'))
    }

    const renderFrame = () => {
      if (aborted) return
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(video, 0, 0, width, height)
      const t = video.currentTime
      const cue = activeCueAt(cues, t)
      drawCaptionFrame(ctx, { cue, time: t, style, width, height })
      if (duration > 0) opts.onProgress?.(Math.min(1, t / duration))

      if (video.ended) {
        stopAll()
        return
      }
      rafId = requestAnimationFrame(renderFrame)
    }

    recorder.start(100)
    video.currentTime = 0
    video
      .play()
      .then(() => {
        renderFrame()
      })
      .catch((err) => {
        cleanup()
        reject(err instanceof Error ? err : new Error(String(err)))
      })
  })
}
