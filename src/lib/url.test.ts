import { describe, expect, it } from 'vitest'
import activities from '../content/activities.de.json'
import scenario from '../content/first30days.de.json'
import { safeUrl } from './url'

describe('safeUrl', () => {
  it('keeps https and drops everything else', () => {
    expect(safeUrl('https://www.bamf.de/x')).toBe('https://www.bamf.de/x')
    expect(safeUrl('http://example.com')).toBeUndefined()
    expect(safeUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeUrl('data:text/html,<script>')).toBeUndefined()
    expect(safeUrl('/relative')).toBeUndefined()
  })
  it('every link in the content is https', () => {
    const all = [...JSON.stringify([scenario, activities]).matchAll(/"url":"([^"]*)"/g)].map((m) => m[1])
    expect(all.length).toBeGreaterThan(20)
    for (const u of all) expect(safeUrl(u), u).toBeDefined()
  })
})
