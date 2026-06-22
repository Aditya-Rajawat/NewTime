# NewTime Captions

Generate **dynamic, animated captions** for short-form video — Instagram Reels,
YouTube Shorts and TikTok — entirely in your browser. Upload a clip, let the
built-in speech-to-text transcribe every word with timing, pick a caption style,
fine-tune it, and export a ready-to-post video with the captions burned in.

> No servers, no uploads, no API keys. Your video never leaves your device —
> transcription (Whisper) and video rendering both run client-side.

![NewTime Captions](public/vite.svg)

## Features

- **In-browser auto-captioning** — Whisper (via
  [`@huggingface/transformers`](https://github.com/huggingface/transformers.js))
  runs in a Web Worker and returns **word-level timestamps**, so captions sync to
  speech.
- **Animated, word-by-word captions** — the classic short-form look: the active
  word is highlighted/recoloured/scaled as it's spoken, with entrance animations
  (pop, fade, slide-up, word-by-word).
- **Six style presets** — Hype, Karaoke, Clean, Bounce, Neon, Subtitle — plus
  full customization: font, weight, size, colours, outline, glow, background
  pill, position, words-per-cue and more.
- **Live canvas preview** — captions are rendered on a canvas overlaid on the
  video and stay perfectly in sync while you scrub and edit.
- **Transcript editor** — fix words inline, click any cue to seek, delete words,
  nudge per-word timing, and globally shift all captions to fix sync drift.
- **Type-a-script mode** — no speech? Paste a script and the words are spread
  across the clip automatically.
- **One-click export** — renders the captioned video with a canvas capture
  stream + `MediaRecorder` (MP4 where supported, otherwise WebM) and offers a
  download.

## Tech stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite 6](https://vite.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [`@huggingface/transformers`](https://github.com/huggingface/transformers.js)
  (Whisper ASR running on WASM/WebGPU)
- Canvas 2D for caption rendering · `MediaRecorder` for export

## Getting started

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
```

Then open the printed URL, drop in a vertical video, and click **Auto-caption**.

> The first transcription downloads the Whisper model (~40–75 MB depending on
> the model picked). It is cached by the browser for subsequent runs.

### Other scripts

```bash
npm run build      # type-check + production build
npm run preview    # serve the production build locally
npm run lint       # run ESLint
npm run typecheck  # type-check only
```

## How it works

1. **Decode** — the uploaded file's audio is decoded to mono 16 kHz PCM with the
   Web Audio API (`decodeAudio`).
2. **Transcribe** — the PCM is sent to a Web Worker that runs Whisper with
   `return_timestamps: 'word'`, producing a flat list of timed `Word`s.
3. **Cue building** — words are grouped into on-screen **cues** based on
   words-per-cue, pauses and sentence boundaries (`buildCues`).
4. **Render** — for each frame, the active cue is drawn on a canvas with the
   current style and active-word emphasis (`drawCaptionFrame`). The same function
   powers both the live preview and the export.
5. **Export** — a hidden video is played through while frames + captions are
   drawn to an offscreen canvas; the canvas stream and the video's audio are
   recorded with `MediaRecorder`.

## Browser support

Best experienced in a recent **Chrome/Edge** (WebGPU/WASM + canvas capture +
`MediaRecorder`). Safari and Firefox work too; the export container falls back
from MP4 to WebM depending on `MediaRecorder` support.

## Project structure

```
src/
  App.tsx                  # app shell + state orchestration
  components/
    Uploader.tsx           # drag & drop upload
    PreviewStage.tsx       # video + live caption overlay + transport
    StylePanel.tsx         # presets + style controls
    TranscriptEditor.tsx   # editable, seekable transcript
  lib/
    types.ts               # shared types
    presets.ts             # style presets + fonts
    cues.ts                # word -> cue grouping
    renderCaptions.ts      # canvas caption renderer (preview + export)
    transcribe.ts          # audio decode + worker orchestration
    transcribe.worker.ts   # Whisper inference worker
    exportVideo.ts         # canvas + MediaRecorder export pipeline
    format.ts              # time/byte formatting
```
