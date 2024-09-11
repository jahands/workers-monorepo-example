import { DateTime } from 'luxon'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'

import { getWeatherExpiration, parseWeatherTime, weatherAPIUrl, WeatherResponse } from './weather'

beforeEach(() => {
	vi.useFakeTimers()
})
afterEach(() => {
	vi.useRealTimers()
})

function setTime(time: string) {
	const dt = DateTime.fromISO(time, {
		zone: 'America/Chicago',
	})
	if (!dt.isValid) throw new Error('Invalid time')
	vi.setSystemTime(dt.toMillis())
}

describe('DateTime', () => {
	it('should parse datetime without timezone', () => {
		const time = '2024-06-03T16:30' // opne-meteo format for UTC
		const dt = DateTime.fromISO(time, { zone: 'America/Chicago' })
		expect(dt.toISO()).toMatchInlineSnapshot(`"2024-06-03T16:30:00.000-05:00"`)
	})
})

describe('parseWeatherTime', () => {
	it('should parse to America/Chicago', () => {
		const parsed = parseWeatherTime('2024-06-03T16:30')
		expect(parsed).toMatchInlineSnapshot(`"2024-06-03T16:30:00.000-05:00"`)
		expect(parsed.zoneName).toBe('America/Chicago')
	})
})

describe('getWeatherExpiration', () => {
	test('1 minute after refresh', () => {
		setTime('2024-06-03T16:31')
		const updatedAt = parseWeatherTime('2024-06-03T16:30')
		expect(getWeatherExpiration(updatedAt)).toMatchInlineSnapshot(`"2024-06-03T16:50:00.000-05:00"`)
	})
	test('1 minute before refresh', () => {
		setTime('2024-06-03T16:29')
		const updatedAt = parseWeatherTime('2024-06-03T16:15')
		expect(getWeatherExpiration(updatedAt)).toMatchInlineSnapshot(`"2024-06-03T16:35:00.000-05:00"`)
	})
})

describe('weatherAPIUrl', () => {
	it('should return the correct URL', () => {
		// This is here so that it's easy to open the URL for testing.
		expect(weatherAPIUrl).toMatchInlineSnapshot(
			`"https://api.open-meteo.com/v1/forecast?latitude=30.3546734&longitude=-97.7546851&current=temperature_2m,relative_humidity_2m,apparent_temperature,uv_index,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,uv_index_max&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FChicago&forecast_days=1"`
		)
	})
})

describe('schema', () => {
	test('weatherResponse', () => {
		const payload = {
			latitude: 30.349277,
			longitude: -97.75366,
			generationtime_ms: 0.08296966552734375,
			utc_offset_seconds: -18000,
			timezone: 'America/Chicago',
			timezone_abbreviation: 'CDT',
			elevation: 250,
			current_units: {
				time: 'iso8601',
				interval: 'seconds',
				temperature_2m: '°F',
				relative_humidity_2m: '%',
				apparent_temperature: '°F',
				uv_index: '',
				wind_speed_10m: 'mp/h',
			},
			current: {
				time: '2024-06-04T18:45',
				interval: 900,
				temperature_2m: 96.3,
				relative_humidity_2m: 49,
				apparent_temperature: 101.9,
				uv_index: 2.3,
				wind_speed_10m: 11,
			},
			daily_units: {
				time: 'iso8601',
				temperature_2m_max: '°F',
				temperature_2m_min: '°F',
				uv_index_max: '',
			},
			daily: {
				time: ['2024-06-04'],
				temperature_2m_max: [96.5],
				temperature_2m_min: [78.8],
				uv_index_max: [8.3],
			},
		}
		expect(() => WeatherResponse.parse(payload)).not.toThrow()
	})
})
