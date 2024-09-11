import * as z from 'zod'

export const allergySeverities = ['Low', 'Medium', 'High', 'Very high', 'Extreme'] as const

export type AllergySeverity = z.infer<typeof AllergySeverity>
export const AllergySeverity = z.enum(['Low', 'Medium', 'High', 'Very high', 'Extreme'])

export function getHighestSeverity(severities: AllergySeverity[]): AllergySeverity {
	let highest: AllergySeverity = 'Low'
	for (const severity of allergySeverities) {
		if (severities.some((s) => s === severity)) {
			highest = severity
		}
	}
	return highest
}

export type Allergy = z.infer<typeof Allergy>
export const Allergy = z.object({
	x: z.array(z.string()),
	y: z.array(z.number()),
	misery: z.array(z.number()),
	'24_hour_avg_pollen': z.number(),
	'24_hour_severity': AllergySeverity,
	'24_hour_avg_misery': z.number(),
	sort_value: z.number(),
})

export type AllergyResponse = z.infer<typeof AllergyResponse>
export const AllergyResponse = z
	.object({
		runtime: z.string(),
	})
	.catchall(Allergy)

/** Easier to use than AllergyResponse */
export type AllergyData = z.infer<typeof AllergyData>
export const AllergyData = z.object({
	allergens: z.record(z.string(), Allergy),
	runtime: z.string(),
})
