import type { Word } from './types'
import { uid } from './id'
import type { TranscribeRequest, WorkerMessage } from './transcribe.worker'

export const WHISPER_MODELS = [
  { value: 'Xenova/whisper-tiny.en', label: 'Tiny · English (fastest, ~40MB)' },
  { value: 'Xenova/whisper-base.en', label: 'Base · English (~75MB)' },
  { value: 'Xenova/whisper-tiny', label: 'Tiny · Multilingual (~40MB)' },
  { value: 'Xenova/whisper-base', label: 'Base · Multilingual (~75MB)' },
]

const TARGET_SAMPLE_RATE = 16000

/**
 * Decode a media file's audio track into mono 16kHz PCM, the format Whisper
 * expects. Runs entirely in the browser via the Web Audio API.
 */
export async function decodeAudio(file: File | Blob): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer()
  const AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext
  const tmpCtx = new AudioCtor()
  let decoded: AudioBuffer
  try {
    decoded = await tmpCtx.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    void tmpCtx.close()
  }

  const offline = new OfflineAudioContext(
    1,
    Math.ceil((decoded.duration * TARGET_SAMPLE_RATE) || 1),
    TARGET_SAMPLE_RATE,
  )
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start(0)
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0)
}

export interface TranscribeCallbacks {
  onModelProgress?: (message: string, progress: number) => void
  onStatus?: (message: string) => void
}

export interface Transcriber {
  run(
    audio: Float32Array,
    model: string,
    language: string | undefined,
    cb: TranscribeCallbacks,
  ): Promise<Word[]>
  dispose(): void
}

/** Create a transcriber backed by a dedicated Web Worker. */
export function createTranscriber(): Transcriber {
  const worker = new Worker(
    new URL('./transcribe.worker.ts', import.meta.url),
    { type: 'module' },
  )

  return {
    run(audio, model, language, cb) {
      return new Promise<Word[]>((resolve, reject) => {
        const handle = (event: MessageEvent<WorkerMessage>) => {
          const msg = event.data
          switch (msg.type) {
            case 'model-progress':
              cb.onModelProgress?.(msg.message, msg.progress)
              break
            case 'status':
              cb.onStatus?.(msg.message)
              break
            case 'result': {
              worker.removeEventListener('message', handle)
              resolve(
                msg.words.map((w) => ({
                  id: uid('w'),
                  text: w.text,
                  start: w.start,
                  end: w.end,
                })),
              )
              break
            }
            case 'error':
              worker.removeEventListener('message', handle)
              reject(new Error(msg.message))
              break
          }
        }
        worker.addEventListener('message', handle)
        const req: TranscribeRequest = {
          type: 'transcribe',
          audio,
          model,
          language,
        }
        // Transfer the audio buffer to avoid a copy.
        worker.postMessage(req, [audio.buffer])
      })
    },
    dispose() {
      worker.terminate()
    },
  }
}
