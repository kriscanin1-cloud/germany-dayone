import { useState } from 'react'
import { track } from './analytics'
import { load, update, type Saved } from './storage'

/** Task completion with a confirmation step: ask() opens the question, confirm() applies it. */
export function useDone() {
  const [saved, setSaved] = useState<Saved>(() => load())
  const [asking, setAsking] = useState<{ id: string; title: string; done: boolean } | null>(null)
  const isDone = (id: string) => saved.done.includes(id)
  const ask = (id: string, title: string) => setAsking({ id, title, done: isDone(id) })
  const confirm = () => {
    if (!asking) return
    const { id, done } = asking
    setSaved(update((s) => ({ ...s, done: done ? s.done.filter((x) => x !== id) : [...s.done, id] })))
    track(done ? 'task_undone' : 'task_done', { task: id })
  }
  return { saved, setSaved, isDone, ask, asking, confirm, close: () => setAsking(null) }
}
