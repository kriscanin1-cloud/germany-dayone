import { describe, expect, it } from 'vitest'
import { sanitize } from './storage'

const id = '0b8f9a52-2d6c-4e1f-9a3b-5c7d8e9f0a1b'
describe('sanitize stored data', () => {
  it('rejects garbage and bad ids', () => {
    expect(sanitize(null)).toBeNull()
    expect(sanitize('x')).toBeNull()
    expect(sanitize({ anonId: '<script>', done: [] })).toBeNull()
  })
  it('repairs wrong types instead of crashing', () => {
    const s = sanitize({ anonId: id, done: 'oops', tried: [1, 'bratwurst'], rsvps: { a: 'going', b: 'hack' }, me: { name: 'x'.repeat(500), passportEnd: 'soon' } })!
    expect(s.done).toEqual([])
    expect(s.tried).toEqual(['bratwurst'])
    expect(s.rsvps).toEqual({ a: 'going' })
    expect(s.me!.name!.length).toBe(30)
    expect(s.me!.passportEnd).toBeUndefined()
  })
  it('drops a profile without the fields screens rely on', () => {
    expect(sanitize({ anonId: id, done: [], profile: { purpose: 'study' } })!.profile).toBeUndefined()
  })
})
