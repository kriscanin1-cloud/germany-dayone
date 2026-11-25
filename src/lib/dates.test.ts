import { describe, expect, it } from 'vitest'
import { countdown, humanDays } from './dates'
import { parseDate } from './engine'

const today = parseDate('2026-11-25')
describe('countdown', () => {
  it('grades urgency', () => {
    expect(countdown('2026-11-20', today).urgency).toBe('expired')
    expect(countdown('2026-12-20', today).urgency).toBe('urgent')
    expect(countdown('2027-02-10', today).urgency).toBe('soon')
    expect(countdown('2027-06-01', today).urgency).toBe('ok')
  })
  it('reads naturally', () => {
    expect(humanDays(3)).toBe('in 3 days')
    expect(humanDays(21)).toBe('in 3 weeks')
    expect(humanDays(120)).toBe('in 4 months')
    expect(humanDays(-1)).toBe('1 day ago')
  })
})
