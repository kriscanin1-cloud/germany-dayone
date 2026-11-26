/**
 * Only https links leave the app. Content is ours today, but a `javascript:` or `data:` URL
 * slipped into content (or later from the database) must never become a clickable link.
 */
export function safeUrl(raw: string): string | undefined {
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' ? u.href : undefined
  } catch {
    return undefined
  }
}
