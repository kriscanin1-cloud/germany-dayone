// Countdown to an important date, with a level that decides how loudly we warn.
import { daysBetween, parseDate } from './engine'

export type Urgency = 'expired' | 'urgent' | 'soon' | 'ok'

/** urgent: under 6 weeks (permit appointments take that long); soon: under 3 months */
export function countdown(iso: string, today: Date = new Date()): { days: number; urgency: Urgency } {
  const days = daysBetween(today, parseDate(iso))
  const urgency: Urgency = days < 0 ? 'expired' : days <= 42 ? 'urgent' : days <= 90 ? 'soon' : 'ok'
  return { days, urgency }
}

export function humanDays(days: number): string {
  const a = Math.abs(days)
  const unit = a >= 60 ? `${Math.round(a / 30)} months` : a >= 14 ? `${Math.round(a / 7)} weeks` : `${a} day${a === 1 ? '' : 's'}`
  return days < 0 ? `${unit} ago` : `in ${unit}`
}
