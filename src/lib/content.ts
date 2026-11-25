import scenarioJson from '../content/first30days.de.json'
import placesJson from '../content/places.de.json'
import type { City, Scenario, State } from './types'

export const scenario = scenarioJson as unknown as Scenario
export const states = placesJson.states as State[]
export const cities = placesJson.cities as City[]

/**
 * Drafts are hidden in production unless VITE_SHOW_DRAFTS=true.
 * In local development they are always shown, with a DRAFT badge.
 */
export const SHOW_DRAFTS = import.meta.env.DEV || import.meta.env.VITE_SHOW_DRAFTS === 'true'
