# NewTime Captions

A fully client-side web app that generates dynamic, animated captions for
short-form video (Reels / Shorts / TikTok). React 19 + TypeScript + Vite 6 +
Tailwind 4. Whisper transcription (`@huggingface/transformers`) and video
rendering both run in the browser — there is **no backend, no database, and no
API keys or secrets**.

## Cursor Cloud specific instructions

- The app code lives on the `cursor/dynamic-captions-app-a127` branch. The
  `main` branch is currently an empty placeholder (only a README), so a future
  agent on `main` will not find a `package.json` — the update script is guarded
  to handle that.
- Single frontend service. Standard commands live in `package.json` `scripts`:
  - `npm run dev` — Vite dev server on `http://localhost:5173` (the service to run).
  - `npm run lint` — ESLint.
  - `npm run typecheck` — `tsc -b --noEmit`.
  - `npm run build` — type-check + production build.
- No env vars / `.env` / secrets are required to run, build, or test anything.
- Non-obvious testing gotchas:
  - The **"Auto-caption"** button downloads a Whisper model (~40–75 MB) on first
    use and relies on WebGPU/WASM. It is slow and network-dependent. For fast,
    reliable end-to-end testing of caption rendering, use the **"Type script"**
    flow instead: upload a video, click "Type script", paste lines, click "Set
    captions" — this exercises cue-building + the canvas caption renderer without
    the model download.
  - Export (and best caption rendering) uses canvas capture + `MediaRecorder`;
    Chrome/Edge give the most reliable results (MP4, else WebM fallback).
  - The app requires a video file before captions can be previewed. A throwaway
    vertical clip can be generated with ffmpeg, e.g.
    `ffmpeg -f lavfi -i testsrc=size=720x1280:rate=30:duration=5 -f lavfi -i sine=frequency=440:duration=5 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest sample.mp4`.
