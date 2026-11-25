export type Purpose = 'study' | 'work' | 'chancenkarte' | 'family' | 'other'

/** ISO 3166-2:DE */
export type StateCode =
  | 'DE-BW' | 'DE-BY' | 'DE-BE' | 'DE-BB' | 'DE-HB' | 'DE-HH' | 'DE-HE' | 'DE-MV'
  | 'DE-NI' | 'DE-NW' | 'DE-RP' | 'DE-SL' | 'DE-SN' | 'DE-ST' | 'DE-SH' | 'DE-TH'

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
}

export interface Link {
  label: T
  url: string
  official: boolean
}

export interface Task {
  id: string
  category: Category
  title: T
  summary: T
  why: T
  steps: T[]
  documents: T[]
  deadline: { offsetDays: number; hard: boolean; note?: T }
  dependsOn: string[]
  appliesTo: AppliesTo
  links: Link[]
  lastVerified: string
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
  status: ContentStatus
}

export interface Scenario {
  meta: Record<string, unknown>
  tasks: Task[]
  entitlements: Entitlement[]
}

export interface Profile {
  purpose: Purpose
  eu: boolean
  /** ISO date YYYY-MM-DD */
  arrival: string
  state: StateCode
  cityId?: string
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
