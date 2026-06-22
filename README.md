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

## Deployment

The app is 100% static, so it can be hosted on any static host. This repo is set
up for **GitHub Pages** and will live at:

```
https://aditya-rajawat.github.io/NewTime/
```

GitHub Pages has to be turned on once for the repo (the default Actions token
isn't allowed to enable it automatically). Pick whichever option you prefer:

### Option A — instant, no rebuild (recommended)

A pre-built, verified production bundle is already pushed to the
`cursor/live-build-a127` branch.

1. Go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Branch: **`cursor/live-build-a127`**, folder: **`/ (root)`**, then **Save**.

The site goes live at the URL above within ~1 minute. (The bundle is built with a
relative base, so it works at any path.)

### Option B — auto-rebuild on every push (CI)

1. Go to **Settings → Pages → Source** and choose **GitHub Actions**.
2. Merge this PR into `main` (or run the **Deploy to GitHub Pages** workflow
   from the Actions tab).

The workflow in `.github/workflows/deploy.yml` builds with the correct project
base (`/NewTime/`) and deploys on every push to `main`.

> ⚠️ A standard browser is required to actually run the app (it uses Web Audio,
> Web Workers, Canvas, WebAssembly and `MediaRecorder`). Serve over HTTPS — Pages
> does this automatically.

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
