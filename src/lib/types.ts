export type Purpose = 'study' | 'work' | 'chancenkarte' | 'family' | 'other'

/** ISO 3166-2:DE */
export type StateCode =
  | 'DE-BW' | 'DE-BY' | 'DE-BE' | 'DE-BB' | 'DE-HB' | 'DE-HH' | 'DE-HE' | 'DE-MV'
  | 'DE-NI' | 'DE-NW' | 'DE-RP' | 'DE-SL' | 'DE-SN' | 'DE-ST' | 'DE-SH' | 'DE-TH'

/** Residence status ids, see questionnaire.json → status */
export type ResidenceStatus =
  | 'not_arrived' | 'visa_free' | 'national_visa' | 'fiktion' | 'temporary'
  | 'blue_card' | 'chancenkarte' | 'permanent' | 'protection' | 'not_sure' | 'other'

/** Citizenship group, see questionnaire.json → citizenship.
 * eu = EU/EEA/Switzerland (free movement);
 * best_friend = § 41 AufenthV: may enter visa-free and apply for a permit inside Germany;
 * other = everyone else. */
export type Citizenship = 'eu' | 'best_friend' | 'other'

export type Lang = 'en'
/** Translatable text; `en` is required. */
export type T = Partial<Record<Lang, string>> & { en: string }

export type Category = 'status' | 'money' | 'everyday' | 'people'
export type ContentStatus = 'draft' | 'verified'

export interface AppliesTo {
  purposes: Purpose[] | 'all'
  /** omit = everyone; false = non-EU only; true = EU only */
  euCitizen?: boolean
  /** omit = all of Germany */
  states?: StateCode[]
  /** city ids from places.de.json; omit = everywhere */
  cities?: string[]
  /** residence statuses; omit = any. A profile without a status (e.g. EU citizens) always matches. */
  statuses?: ResidenceStatus[]
  /** citizenship groups; omit = any */
  citizenship?: Citizenship[]
  /** profile answers that must match, e.g. { drives: ['yes','maybe'] }. A missing answer does not match. */
  match?: Partial<Record<MatchField, string[]>>
  /** at least one of these must also apply (OR across alternatives) */
  anyOf?: AppliesTo[]
}

export type MatchField = 'household' | 'housing' | 'drives' | 'germanLevel'

/** Which date a deadline counts from. If that date is unknown, it counts from arrival with fallbackOffsetDays. */
export type DeadlineFrom = 'arrival' | 'moveIn' | 'visaEnd'

export interface Link {
  label: T
  url: string
  official: boolean
}

/** One provider or route to compare, e.g. a mobile network or a bank. */
export interface ChoiceItem {
  name: string
  /** short line under the name, e.g. "Prepaid · O2 network" */
  tag: T
  pros: T[]
  cons: T[]
  url: string
}

export interface Choices {
  title: T
  intro?: T
  items: ChoiceItem[]
  /** e.g. "Prices checked in Nov 2026" */
  note?: T
}

export interface Task {
  id: string
  category: Category
  title: T
  summary: T
  why: T
  steps: T[]
  documents: T[]
  /** options to compare (providers, banks…) */
  choices?: Choices
  /** short practical tips */
  tips?: T[]
  deadline: { offsetDays: number; from?: DeadlineFrom; fallbackOffsetDays?: number; hard: boolean; note?: T }
  dependsOn: string[]
  appliesTo: AppliesTo
  links: Link[]
  lastVerified: string
  /** pages the facts were checked against when it was marked verified */
  sources?: string[]
  status: ContentStatus
}

export interface Entitlement {
  id: string
  title: T
  valueHint: T
  conditions: T[]
  howTo: T
  appliesTo: AppliesTo
  links: Link[]
  lastVerified: string
  /** pages the facts were checked against when it was marked verified */
  sources?: string[]
  status: ContentStatus
}

/** Long-term steps beyond the first weeks (permanent residence, citizenship…). */
export interface Milestone {
  id: string
  title: T
  when: T
  summary: T
  appliesTo: AppliesTo
  links: Link[]
  lastVerified: string
  /** pages the facts were checked against when it was marked verified */
  sources?: string[]
  status: ContentStatus
}

export interface Scenario {
  meta: Record<string, unknown>
  tasks: Task[]
  entitlements: Entitlement[]
  milestones: Milestone[]
}

export interface Profile {
  purpose: Purpose
  /** derived: citizenship === 'eu' */
  eu: boolean
  citizenship?: Citizenship
  /** ISO date YYYY-MM-DD */
  arrival: string
  state: StateCode
  cityId?: string
  /** only asked of non-EU citizens */
  status?: ResidenceStatus
  /** option ids from questionnaire.json */
  household?: string
  germanLevel?: string
  /** option ids: moved_in | soon | searching */
  housing?: string
  /** ISO date of moving into the flat (device only) */
  moveIn?: string
  /** ISO date the visa or permit ends (device only) */
  visaEnd?: string
  /** yes | maybe | no */
  drives?: string
}

export interface State {
  name: string
  code: StateCode
  localName: string
}

export interface City {
  id: string
  name: string
  state: StateCode
  aliases?: string[]
}
