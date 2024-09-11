import type { AllergySeverity } from './schema'

type Thresholds = [medium: number, high: number, veryHigh: number, extreme: number]
type SeverityIcon = '🟢' | '🟡' | '🔴' | '🔴🔴' | '🟣'
/** none severity is for values that have no severity */
export type SeverityType = 'temp' | 'uv' | 'humidity' | 'allergy_misery' | 'none'

function getSeverity(input: number, thresholds: Thresholds): AllergySeverity {
	if (input >= thresholds[3]) return 'Extreme'
	if (input >= thresholds[2]) return 'Very high'
	if (input >= thresholds[1]) return 'High'
	if (input >= thresholds[0]) return 'Medium'
	return 'Low'
}

const severityLevels: Record<string, Thresholds> = {
	temp: [80, 90, 100, 110],
	uv: [3, 6, 8, 11], // https://www.epa.gov/sunsafety/uv-index-scale-0
	humidity: [50, 80, 95, 99],
	allergy_misery: [0.25, 0.5, 0.75, 0.99], // Extreme is not in the API's scale. Only here for types.
} as const

export function getSeverityFor(input: number, type: SeverityType): AllergySeverity {
	if (type === 'none') return 'Low'
	return getSeverity(input, severityLevels[type])
}

export function getSortPriorityFromSeverity(severity: AllergySeverity): number {
	switch (severity) {
		case 'Low':
			return 0
		case 'Medium':
			return 1
		case 'High':
			return 2
		case 'Very high':
			return 3
		case 'Extreme':
			return 4
	}
}

export function getIconForSeverity(s: AllergySeverity): SeverityIcon {
	switch (s) {
		case 'Low':
			return '🟢'
		case 'Medium':
			return '🟡'
		case 'High':
			return '🔴'
		case 'Very high':
			return '🔴🔴'
		case 'Extreme':
			return '🟣'
	}
}
