import en from '../content/i18n/en.json'

export type Key = keyof typeof en

/** English only for now; more languages = more JSON files with the same keys. */
export function t(key: Key, vars: Record<string, string> = {}): string {
  let s: string = en[key] ?? key
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v)
  return s
}
