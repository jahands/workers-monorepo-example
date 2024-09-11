import { DateTime } from 'luxon'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'

import {
	getCacheExpiration,
	getLastRuntime,
	getNextRuntime,
	isAllergyExpired,
	parseAllergyRuntime,
} from './allergyruntime'
import { getNow } from './helpers/time'
import { getHighestSeverity } from './schema'

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

describe('parseAllergyRuntime()', () => {
	test('parse AM', () => {
		const date = parseAllergyRuntime('4/27/2024 - 4:10 AM')
		expect(date.toUTC().toISO()).toBe('2024-04-27T09:10:00.000Z')
	})
	test('parse PM', () => {
		const date = parseAllergyRuntime('4/27/2024 - 3:10 PM')
		expect(date.toUTC().toISO()).toBe('2024-04-27T20:10:00.000Z')
	})
})

describe('isAllergyExpired()', () => {
	test('mock time', () => {
		// make sure mocking works
		setTime('2024-04-27T15:00:00')
		expect(DateTime.now().toUTC().toISO()).toBe('2024-04-27T20:00:00.000Z')
		expect(new Date().toISOString()).toBe('2024-04-27T20:00:00.000Z')
	})

	describe('not expired', () => {
		test('right before expiration', () => {
			setTime('2024-04-27T07:09:00')
			const runtime = parseAllergyRuntime('4/27/2024 - 6:10 AM')
			expect(isAllergyExpired(runtime)).toBe(false)
		})
		test('previous hour', () => {
			setTime('2024-04-27T06:11:00')
			const runtime = parseAllergyRuntime('4/27/2024 - 6:10 AM')
			expect(isAllergyExpired(runtime)).toBe(false)
		})

		test('almost to next hour', () => {
			setTime('2024-04-27T06:59:00')
			const runtime = parseAllergyRuntime('4/27/2024 - 6:10 AM')
			expect(isAllergyExpired(runtime)).toBe(false)
		})
	})

	describe('expired', () => {
		test('right at expiration', () => {
			setTime('2024-04-27T07:10:00')
			const runtime = parseAllergyRuntime('4/27/2024 - 6:10 AM')
			expect(isAllergyExpired(runtime)).toBe(true)
		})
		test('right after expiration', () => {
			setTime('2024-04-27T07:11:00')
			const runtime = parseAllergyRuntime('4/27/2024 - 6:10 AM')
			expect(isAllergyExpired(runtime)).toBe(true)
		})
		test('way after expiration', () => {
			setTime('2024-04-27T09:11:00')
			const runtime = parseAllergyRuntime('4/27/2024 - 6:10 AM')
			expect(isAllergyExpired(runtime)).toBe(true)
		})
	})
})

describe('getNextRuntime()', () => {
	test('next in current hour', () => {
		setTime('2024-04-27T06:00:00')
		expect(getNextRuntime().toISO()).toBe('2024-04-27T06:10:00.000-05:00')
		setTime('2024-04-27T06:09:00')
		expect(getNextRuntime().toISO()).toBe('2024-04-27T06:10:00.000-05:00')
	})
	test('next in next hour', () => {
		setTime('2024-04-27T06:11:00')
		expect(getNextRuntime().toISO()).toBe('2024-04-27T07:10:00.000-05:00')
		setTime('2024-04-27T06:59:59')
		expect(getNextRuntime().toISO()).toBe('2024-04-27T07:10:00.000-05:00')
	})
})

describe('getLastRuntime()', () => {
	test('last in previous hour', () => {
		setTime('2024-04-27T06:00:00')
		expect(getLastRuntime().toISO()).toBe('2024-04-27T05:10:00.000-05:00')

		setTime('2024-04-27T06:09:00')
		expect(getLastRuntime().toISO()).toBe('2024-04-27T05:10:00.000-05:00')

		setTime('2024-04-27T06:09:59')
		expect(getLastRuntime().toISO()).toBe('2024-04-27T05:10:00.000-05:00')
	})
	test('last in current hour', () => {
		setTime('2024-04-27T06:10:00')
		expect(getLastRuntime().toISO()).toBe('2024-04-27T06:10:00.000-05:00')

		setTime('2024-04-27T06:11:00')
		expect(getLastRuntime().toISO()).toBe('2024-04-27T06:10:00.000-05:00')

		setTime('2024-04-27T06:59:59')
		expect(getLastRuntime().toISO()).toBe('2024-04-27T06:10:00.000-05:00')
	})
})

describe('getCacheExpiration()', () => {
	test('expired', () => {
		setTime('2024-04-27T07:11:00')
		const runtime = parseAllergyRuntime('4/27/2024 - 6:10 AM')
		expect(isAllergyExpired(runtime)).toBe(true)
		expect(getCacheExpiration(runtime).toMillis()).toBe(getNow().plus({ minutes: 5 }).toMillis())
	})
	test('expires in 1 minutes', () => {
		setTime('2024-04-27T06:09:00')
		const runtime = parseAllergyRuntime('4/27/2024 - 6:10 AM')
		expect(isAllergyExpired(runtime)).toBe(false)
		expect(getCacheExpiration(runtime).toMillis()).toBe(getNow().plus({ minutes: 5 }).toMillis())
	})
	test('expires in 59 minutes', () => {
		setTime('2024-04-27T05:11:00')
		const runtime = parseAllergyRuntime('4/27/2024 - 6:10 AM')
		expect(getCacheExpiration(runtime).toMillis()).toBe(getNow().plus({ minutes: 64 }).toMillis())
	})
	it('should expire in 60 minutes when at the exact update time', () => {
		setTime('2024-04-27T06:10:00')
		const runtime = parseAllergyRuntime('4/27/2024 - 6:10 AM')
		// 5 extra minutes for the API to update
		expect(getCacheExpiration(runtime).toMillis()).toBe(getNow().plus({ minutes: 65 }).toMillis())

		// Also works if we're a few seconds into the 10th minute
		setTime('2024-04-27T06:10:30')
		expect(getCacheExpiration(runtime).toMillis()).toBe(
			getNow().plus({ minutes: 65 }).minus({ seconds: 30 }).toMillis()
		)
	})
})

describe('DateTime', () => {
	test('greater than', () => {
		const dt = DateTime.now().setZone('America/Chicago')
		const dt2 = dt.plus({ minutes: 10 })
		expect(dt2 > dt).toBe(true)
	})
	test('less than', () => {
		const dt = DateTime.now().setZone('America/Chicago')
		const dt2 = dt.minus({ minutes: 10 })
		expect(dt2 < dt).toBe(true)
	})
	test('equal', () => {
		const dt = DateTime.now().setZone('America/Chicago')
		const dt2 = dt.plus({ minutes: 10 })
		expect(dt2.equals(dt2)).toBe(true)
		expect(dt2 === dt2).toBe(true)
		expect(dt2.equals(dt)).toBe(false)
		expect(dt2 === dt).toBe(false)
	})
})

describe('getHighestSeverity', () => {
	test('should work', () => {
		expect(getHighestSeverity(['Medium', 'Low'])).toBe('Medium')
		expect(getHighestSeverity(['Low', 'High', 'Very high', 'Low'])).toBe('Very high')
	})
})
