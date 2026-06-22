import { useCallback, useRef, useState } from 'react'

interface Props {
  onFile: (file: File) => void
}

const SAMPLE_HINT = ['MP4', 'WebM', 'MOV']

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
    <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-10">
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
        className={`group flex w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-8 py-16 text-center transition ${
          dragging
            ? 'border-fuchsia-400 bg-fuchsia-500/10'
            : 'border-white/15 bg-white/[0.03] hover:border-fuchsia-400/60 hover:bg-white/[0.05]'
        }`}
      >
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-3xl shadow-lg shadow-fuchsia-500/30">
          ⬆
        </div>
        <p className="text-lg font-semibold text-white">
          Drop a video here, or click to upload
        </p>
        <p className="mt-2 max-w-sm text-sm text-white/50">
          Your clip never leaves your device — transcription and rendering run
          entirely in your browser.
        </p>
        <div className="mt-5 flex gap-2">
          {SAMPLE_HINT.map((f) => (
            <span
              key={f}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60"
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

      <ul className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { t: '1 · Upload', d: 'Add your Reel, Short or TikTok clip.' },
          { t: '2 · Auto-caption', d: 'AI transcribes every word with timing.' },
          { t: '3 · Style & export', d: 'Pick a look and download the video.' },
        ].map((s) => (
          <li
            key={s.t}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <p className="text-sm font-semibold text-fuchsia-300">{s.t}</p>
            <p className="mt-1 text-sm text-white/55">{s.d}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
