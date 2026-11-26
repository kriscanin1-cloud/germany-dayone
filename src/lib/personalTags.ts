import { INTERESTS, type InterestLabel } from './personal'

/** How many of these tags match the person's interests. */
export function tagsMatch(tags: string[] = [], interests: string[] = []): number {
  const mine = new Set(interests.map((i) => INTERESTS[i as InterestLabel]).filter(Boolean))
  return tags.filter((t) => mine.has(t as never)).length
}
