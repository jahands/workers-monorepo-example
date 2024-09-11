import { DateTime } from 'luxon'
import { z } from 'zod'

import { retry } from './helpers/retry'
import { getNow } from './helpers/time'

import type { SeverityType } from './severity'
import type { AppContext } from './types'

// Location: 30.3546734, -97.7546851 (78757)
// Note: Any hourly param can be used in current as well.
// https://open-meteo.com/en/docs

export const weatherAPIUrl = [
	'https://api.open-meteo.com/v1/forecast?latitude=30.3546734&longitude=-97.7546851',
	'current=temperature_2m,relative_humidity_2m,apparent_temperature,uv_index,wind_speed_10m',
	'daily=temperature_2m_max,temperature_2m_min,uv_index_max',
	'temperature_unit=fahrenheit',
	'wind_speed_unit=mph',
	'precipitation_unit=inch',
	'timezone=America%2FChicago',
	'forecast_days=1',
].join('&')

export type WeatherResponse = z.infer<typeof WeatherResponse>
/** Schema for weather response. Need to update whenever we
 * update apiUrl above. https://transform.tools/json-to-zod
 **/
export const WeatherResponse = z.object({
	latitude: z.number(),
	longitude: z.number(),
	generationtime_ms: z.number(),
	utc_offset_seconds: z.literal(-18000), // Should never change
	timezone: z.string(),
	// Should always be CDT because it's what we asked for
	timezone_abbreviation: z.literal('CDT'),
	elevation: z.number(),
	current_units: z.object({
		time: z.string(),
		interval: z.string(),
		temperature_2m: z.string(),
		relative_humidity_2m: z.string(),
		apparent_temperature: z.string(),
		uv_index: z.string(),
		wind_speed_10m: z.string(),
	}),
	current: z.object({
		time: z.string(),
		interval: z.number(),
		temperature_2m: z.number(),
		relative_humidity_2m: z.number(),
		apparent_temperature: z.number(),
		uv_index: z.number(),
		wind_speed_10m: z.number(),
	}),
	daily_units: z.object({
		time: z.string(),
		temperature_2m_max: z.string(),
		temperature_2m_min: z.string(),
		uv_index_max: z.string(),
	}),
	daily: z.object({
		time: z.array(z.string()).min(1).max(1),
		temperature_2m_max: z.array(z.number()).min(1).max(1),
		temperature_2m_min: z.array(z.number()).min(1).max(1),
		uv_index_max: z.array(z.number()).min(1).max(1),
	}),
})

export async function getWeatherData(c: AppContext): Promise<WeatherResponse> {
	const stub = c.env.ALLERGYDO.get(c.env.ALLERGYDO.idFromName('allergies'))
	const data = await retry(() => stub.getWeatherData())
	return data
}

export type WeatherType = z.infer<typeof WeatherType>
export const WeatherType = z.enum([
	'current_temp',
	'temp_feels_like',
	'current_humidity',
	'current_uv',
	'current_wind',
	'daily_min',
	'daily_max',
	'daily_uv',
	'updated_at',
])

/** Gets the given weather type for easy formatting on the StreamDeck */
export function getWeatherValue(
	data: WeatherResponse,
	type: WeatherType
): {
	label: string
	value: number
	formattedValue: string
	severityType: SeverityType
	useIcon: boolean
} {
	switch (type) {
		case 'current_temp':
			return {
				label: 'Temp',
				value: data.current.temperature_2m,
				formattedValue: `${data.current.temperature_2m}${data.current_units.temperature_2m}`,
				severityType: 'temp',
				useIcon: true,
			}
		case 'temp_feels_like':
			return {
				label: 'Feel',
				value: data.current.apparent_temperature,
				formattedValue: `${data.current.apparent_temperature}${data.current_units.apparent_temperature}`,
				severityType: 'temp',
				useIcon: true,
			}
		case 'current_humidity':
			return {
				label: 'Humid',
				value: data.current.relative_humidity_2m,
				formattedValue: `${data.current.relative_humidity_2m}${data.current_units.relative_humidity_2m}`,
				severityType: 'humidity',
				useIcon: true,
			}
		case 'current_uv':
			return {
				label: 'UV',
				value: data.current.uv_index,
				formattedValue: `${data.current.uv_index}${data.current_units.uv_index}`,
				severityType: 'uv',
				useIcon: true,
			}
		case 'current_wind':
			return {
				label: 'Wind',
				value: data.current.wind_speed_10m,
				formattedValue: `${data.current.wind_speed_10m}\n${data.current_units.wind_speed_10m}`,
				severityType: 'none',
				useIcon: false,
			}
		case 'daily_min':
			return {
				label: 'Min',
				value: data.daily.temperature_2m_min[0],
				formattedValue: `${data.daily.temperature_2m_min[0]}${data.daily_units.temperature_2m_min}`,
				severityType: 'temp',
				useIcon: true,
			}
		case 'daily_max':
			return {
				label: 'Max',
				value: data.daily.temperature_2m_max[0],
				formattedValue: `${data.daily.temperature_2m_max[0]}${data.daily_units.temperature_2m_max}`,
				severityType: 'temp',
				useIcon: true,
			}
		case 'daily_uv':
			return {
				label: 'MaxUV',
				value: data.daily.uv_index_max[0],
				formattedValue: `${data.daily.uv_index_max[0]}${data.daily_units.uv_index_max}`,
				severityType: 'uv',
				useIcon: true,
			}
		case 'updated_at': {
			const updatedAt = parseWeatherTime(data.current.time).toMillis()
			return {
				label: 'Weather\nUpdated',
				value: updatedAt,
				formattedValue: parseWeatherTime(data.current.time).toFormat('h:mm a'),
				severityType: 'none',
				useIcon: false,
			}
		}
	}
}

export function parseWeatherTime(timestamp: string): DateTime {
	return DateTime.fromISO(timestamp, { zone: 'America/Chicago' })
}

export function getWeatherExpiration(updatedAt: DateTime): DateTime {
	const now = getNow()
	let expiration = updatedAt.plus({ minutes: 15 })
	while (expiration.toMillis() < now.toMillis()) {
		expiration = expiration.plus({ minutes: 15 }) // Data updates every 15 minutes
	}
	return expiration.plus({ minutes: 5 }) // Extra padding
}
