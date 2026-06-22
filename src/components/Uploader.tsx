import { useCallback, useRef, useState } from 'react'

interface Props {
  onFile: (file: File) => void
}

const SAMPLE_HINT = ['MP4', 'WebM', 'MOV', 'No watermark']

export default function Uploader({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return
      if (!file.type.startsWith('video/')) {
        alert('Please choose a video file (MP4, WebM or MOV).')
        return
      }
      onFile(file)
    },
    [onFile],
  )

  return (
    <div className="relative mx-auto flex max-w-2xl flex-col items-center px-0 py-8 lg:px-6">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={`group relative flex w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[2rem] border px-8 py-14 text-center shadow-2xl shadow-black/30 transition ${
          dragging
            ? 'border-fuchsia-300 bg-fuchsia-500/15'
            : 'border-white/10 bg-white/[0.055] hover:border-fuchsia-300/60 hover:bg-white/[0.08]'
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(217,70,239,0.22),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_35%)]" />
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 text-3xl font-black text-white shadow-lg shadow-fuchsia-500/30 transition group-hover:scale-105">
          UP
        </div>
        <p className="relative text-2xl font-black tracking-tight text-white">
          Drop your video here
        </p>
        <p className="relative mt-2 max-w-md text-sm leading-6 text-white/60">
          Click to browse or drag in a clip. Transcription and rendering stay on
          this device, so your project remains private and free.
        </p>
        <div className="relative mt-6 flex flex-wrap justify-center gap-2">
          {SAMPLE_HINT.map((f) => (
            <span
              key={f}
              className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold text-white/65"
            >
              {f}
            </span>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <ul className="mt-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { t: 'Upload', d: 'Add your Reel, Short, or TikTok clip.' },
          { t: 'Caption', d: 'Generate captions or paste a script.' },
          { t: 'Export', d: 'Download a watermark-free video.' },
        ].map((s) => (
          <li
            key={s.t}
            className="rounded-3xl border border-white/10 bg-black/25 p-4 text-left backdrop-blur"
          >
            <p className="text-sm font-black text-fuchsia-200">{s.t}</p>
            <p className="mt-1 text-sm leading-6 text-white/50">{s.d}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
