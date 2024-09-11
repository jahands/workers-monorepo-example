import { retry } from './helpers/retry'
import { Allergy } from './schema'
import { getIconForSeverity, getSeverityFor, getSortPriorityFromSeverity } from './severity'

import type { AllergyData } from './schema'
import type { AppContext } from './types'

export const ALLERGY_DATA_KV_CACHE_KEY = 'allergies/allergyData'
export interface AllergyKVCacheMetadata {
	/** Expiration timestamp (ms) */
	expiresAt: number
}

export function formatAllergy(allergyType: string, allergy: Allergy): string {
	const last24HourSeverity = allergy['24_hour_severity']

	// We skip the latest datapoint because it's always 0 (no data yet)
	const last12HourSeverity = getSeverityFor(
		allergy.misery.slice(-13, -1).reduce((a, b) => a + b, 0) / 12,
		'allergy_misery'
	)

	const last6HourSeverity = getSeverityFor(
		allergy.misery.slice(-7, -1).reduce((a, b) => a + b, 0) / 6,
		'allergy_misery'
	)

	const show6h = last6HourSeverity !== last12HourSeverity
	// If 6h is shown, then show 12h so we don't get confused
	const show12h = show6h || last12HourSeverity !== last24HourSeverity
	let fmt = `${allergyType}`
	if (!show12h && !show6h) {
		fmt += `\n${getIconForSeverity(last24HourSeverity)}`
	} else {
		fmt += `\n24h ${getIconForSeverity(last24HourSeverity)}`
	}
	if (show12h) {
		fmt += `\n12h ${getIconForSeverity(last12HourSeverity)}`
	}
	if (show6h) {
		fmt += `\n6h ${getIconForSeverity(last6HourSeverity)}`
	}
	return fmt
}

export function sortAllergiesBySeverity(
	allergies: Record<string, Allergy>
): Array<[string, Allergy]> {
	// Sort by Low, Medium, High, Very high
	const sortedAllergies = Object.entries(allergies).sort(
		(a, b) =>
			getSortPriorityFromSeverity(b[1]['24_hour_severity']) -
			getSortPriorityFromSeverity(a[1]['24_hour_severity'])
	)
	return sortedAllergies
}

export async function getAllergyData(c: AppContext): Promise<AllergyData> {
	const stub = c.env.ALLERGYDO.get(c.env.ALLERGYDO.idFromName('allergies'))
	const data = await retry(() => stub.getAllergyData())

	const allergens: Record<string, Allergy> = {}
	for (const [key, value] of Object.entries(data)) {
		const parsed = Allergy.safeParse(value)
		if (parsed.success) {
			allergens[key] = parsed.data
		}
	}
	const allergyData: AllergyData = {
		runtime: data.runtime,
		allergens,
	}
	return allergyData
}

export function numberWithCommas(n: number): string {
	return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
