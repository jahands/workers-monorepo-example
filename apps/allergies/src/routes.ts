import { markdownTable } from 'markdown-table'

import { newHTTPException } from '@repo/hono-helpers'

import { formatAllergy, getAllergyData, sortAllergiesBySeverity } from './allergies'
import { getIconForSeverity, getSeverityFor } from './severity'
import { getWeatherData, getWeatherValue } from './weather'

import type { Context } from 'hono'
import type { App, AppContext, Llama3Message } from './types'
import type { WeatherType } from './weather'

export { getAllergyReportAppleShortcut } from './appleWatch'

export async function getAllergy(c: Context<App>, allergyType: string): Promise<Response> {
	const data = await getAllergyData(c)
	const allergy = data.allergens[allergyType]

	return c.text(formatAllergy(allergyType, allergy))
}

export async function getTopNAllergy(c: Context<App>, allergyIndex: number): Promise<Response> {
	const data = await getAllergyData(c)
	const allergies = data.allergens
	const len = Object.entries(allergies).length
	if (allergyIndex >= len) {
		return c.text('None')
	}

	// Sort allergies by sort value
	const sortedAllergies = sortAllergiesBySeverity(allergies)
	const allergy = sortedAllergies[allergyIndex]

	return c.text(formatAllergy(allergy[0], allergy[1]))
}

export async function getLastUpdateTime(c: Context<App>): Promise<Response> {
	const data = await getAllergyData(c)
	// Example: 4/21/2024 - 9:10 AM
	const lastUpdateTime = data.runtime

	// Format it to be more readable
	const parts = lastUpdateTime.split(' - ')
	// Remove the year from the date
	// const date = parts[0].split('/').slice(0, 2).join('/')
	const time = parts[1]
	const fmt = `Allergies\nUpdated\n${time}`

	return c.text(fmt)
}

export async function getAllergyReport(c: Context<App>): Promise<Response> {
	const data = await getAllergyReportData(c)
	return c.text(data)
}

async function getAllergyReportData(c: AppContext): Promise<string> {
	const data = await getAllergyData(c)
	const allergiesObj = data.allergens
	const lastUpdateTime = data.runtime

	// Sort allergies by sort value
	const allergies = sortAllergiesBySeverity(allergiesObj)
	const allergiesFormattedForAI = allergies
		.map(([allergyType, allergy]) => {
			const latestMisery = allergy.misery.at(-2)
			if (latestMisery === undefined)
				throw newHTTPException(500, 'Failed to get latest allergy data 1')

			const severity24hr = allergy['24_hour_severity']

			const latestValue = allergy.y.at(-2)
			if (!latestValue === undefined)
				throw newHTTPException(500, 'Failed to get latest allergy data 2')

			return [`Allergen: ${allergyType}`, `Severity: ${severity24hr}`].join('\n')
		})
		.join('\n\n')

	const messages: Llama3Message[] = [
		{
			role: 'system',
			content: 'You are an assistent for summarizing outdoor allergy data',
		},
		{
			role: 'user',
			content: `Here is today's allergy report: ${allergiesFormattedForAI}`,
		},
		{
			role: 'user',
			content: [
				`Summarize the above allergy report in a snarky tone of voice.`,
				`Address the user as Crestview Commoners.`,
				`Always include the severity of each allergen, but only if you're very confident you know what the severity is.`,
				`Make all instances of a specific allergen bold by surrounding it with double asterisks.`,
			].join(' '),
		},
	]
	const { response } = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
		messages,
	})
	const markdownHeaders = ['Allergen', 'Severity', 'Avg']
	const markdownData = allergies.map(([allergyType, allergy]) => {
		const severity24hr = allergy['24_hour_severity']
		return [allergyType, severity24hr, allergy['24_hour_avg_pollen'].toString()]
	})
	const markdownTableString = markdownTable([markdownHeaders, ...markdownData])
	const manualReport = `Allergy Report for ${lastUpdateTime} (24 hour avg):\n${markdownTableString}`
	return `${response}\n\n\`\`\`\n${manualReport}\nSource: https://www.kxan.com/allergy/\n\`\`\``.trim()
}

export async function reportToDiscord(c: AppContext): Promise<void> {
	const data = await getAllergyReportData(c)
	const res = await fetch(c.env.CRESTVIEW_ALLERGIES_DISCORD_HOOK, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ content: data }),
	})
	if (!res.ok) {
		throw newHTTPException(500, 'Failed to send allergy data to Discord')
	}
}

export async function getWeatherForStreamDeck(
	c: Context<App>,
	type: WeatherType
): Promise<Response> {
	const d = await getWeatherData(c)
	const weather = getWeatherValue(d, type)
	let text = `${weather.label}\n${weather.formattedValue}`
	if (weather.useIcon) {
		const icon = getIconForSeverity(getSeverityFor(weather.value, weather.severityType))
		text += `\n${icon}`
	}
	return c.text(text)
}
