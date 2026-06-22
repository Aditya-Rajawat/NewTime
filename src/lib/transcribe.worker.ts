/// <reference lib="webworker" />
import {
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type ProgressInfo,
} from '@huggingface/transformers'

export interface TranscribeRequest {
  type: 'transcribe'
  audio: Float32Array
  model: string
  language?: string
}

export interface WordChunk {
  text: string
  start: number
  end: number
}

export type WorkerMessage =
  | { type: 'model-progress'; message: string; progress: number }
  | { type: 'status'; message: string }
  | { type: 'result'; words: WordChunk[] }
  | { type: 'error'; message: string }

let transcriber: AutomaticSpeechRecognitionPipeline | null = null
let loadedModel = ''

const ctx = self as unknown as DedicatedWorkerGlobalScope

async function getTranscriber(model: string) {
  if (transcriber && loadedModel === model) return transcriber

  const fileProgress = new Map<string, number>()
  // The `pipeline` factory has a very large overloaded return type; cast it to a
  // simple signature so the type-checker does not blow up (TS2590).
  const createPipeline = pipeline as unknown as (
    task: string,
    model: string,
    options: Record<string, unknown>,
  ) => Promise<AutomaticSpeechRecognitionPipeline>

  transcriber = await createPipeline('automatic-speech-recognition', model, {
    dtype: 'q8',
    progress_callback: (info: ProgressInfo) => {
      if (info.status === 'progress' && 'file' in info) {
        fileProgress.set(info.file, info.progress ?? 0)
        const values = [...fileProgress.values()]
        const avg = values.reduce((a, b) => a + b, 0) / values.length
        ctx.postMessage({
          type: 'model-progress',
          message: `Downloading model… ${Math.round(avg)}%`,
          progress: avg,
        } satisfies WorkerMessage)
      } else if (info.status === 'ready') {
        ctx.postMessage({
          type: 'model-progress',
          message: 'Model ready',
          progress: 100,
        } satisfies WorkerMessage)
      }
    },
  })
  loadedModel = model
  return transcriber
}

ctx.addEventListener('message', async (event: MessageEvent<TranscribeRequest>) => {
  const data = event.data
  if (data.type !== 'transcribe') return

  try {
    const asr = await getTranscriber(data.model)

    ctx.postMessage({
      type: 'status',
      message: 'Transcribing audio…',
    } satisfies WorkerMessage)

    const output = await asr(data.audio, {
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
      language: data.language,
    })

    const single = Array.isArray(output) ? output[0] : output
    const chunks =
      (single as { chunks?: { text: string; timestamp: [number, number] }[] })
        .chunks ?? []

    const words: WordChunk[] = []
    let lastEnd = 0
    for (const chunk of chunks) {
      const text = chunk.text.trim()
      if (!text) continue
      const start = chunk.timestamp?.[0] ?? lastEnd
      let end = chunk.timestamp?.[1]
      if (end == null || end <= start) end = start + 0.3
      words.push({ text, start, end })
      lastEnd = end
    }

    ctx.postMessage({ type: 'result', words } satisfies WorkerMessage)
  } catch (err) {
    ctx.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    } satisfies WorkerMessage)
  }
})
