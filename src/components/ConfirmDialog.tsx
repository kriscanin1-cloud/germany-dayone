import { useEffect, useRef } from 'react'

/** A small modal question with two answers. Uses <dialog> for focus trapping and Esc. */
export function ConfirmDialog({
  open,
  title,
  body,
  yes,
  no,
  onYes,
  onClose,
}: {
  open: boolean
  title: string
  body?: string
  yes: string
  no: string
  onYes: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal?.()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[calc(100%-2.5rem)] max-w-sm rounded-md border-2 border-ink bg-paper p-0 text-ink backdrop:bg-ink/50"
    >
      <div className="p-5">
        <p className="font-sign text-2xl leading-tight font-bold">{title}</p>
        {body && <p className="mt-2 text-muted">{body}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-md border-2 border-ink py-3 font-semibold">
            {no}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => {
              onYes()
              onClose()
            }}
            className="flex-1 rounded-md bg-ink py-3 font-semibold text-paper"
          >
            {yes}
          </button>
        </div>
      </div>
    </dialog>
  )
}
