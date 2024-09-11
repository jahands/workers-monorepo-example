import { ms } from 'itty-time'
import { DateTime } from 'luxon'

import { getNow } from './helpers/time'

export function parseAllergyRuntime(runtime: string): DateTime {
	// Example runtime: 4/27/2024 - 3:10 PM
	const dt = DateTime.fromFormat(runtime, 'M/d/yyyy - h:mm a', {
		zone: 'America/Chicago',
	})
	if (!dt.isValid) {
		throw new Error('Invalid runtime')
	}
	return dt
}

export function isAllergyExpired(runtime: DateTime): boolean {
	return runtime < getLastRuntime()
}

export function getNextRuntime(): DateTime {
	const now = getNow()
	// >= 10 so that we return the current minute if
	// we're currently updating. It's technically
	// slightly wrong, but was the easiest way
	// to ensure we have a 60 minute ttl when we've
	// just updated.
	return now
		.plus({ hours: now.minute >= 10 ? 1 : 0 })
		.startOf('hour')
		.plus({ minutes: 10 })
}

export function getLastRuntime(): DateTime {
	const now = getNow()
	return now
		.minus({ hours: now.minute < 10 ? 1 : 0 })
		.startOf('hour')
		.plus({ minutes: 10 })
}

/** Cache TTL will set a higher ttl if we've already
 * received the next runtime, otherwise defaults to 5 minutes.
 * @returns expiration date
 */
export function getCacheExpiration(runtime: DateTime): DateTime {
	const now = getNow()
	if (isAllergyExpired(runtime)) {
		return now.plus({ minutes: 5 })
	}
	const nextRuntime = getNextRuntime()
	const diff = nextRuntime.diff(now)
	if (diff.toMillis() < ms('5 minutes')) {
		// Never return less than 5 minutes
		return now.plus({ minutes: 5 })
	}
	// The API doesn't have the next runtime right at 10 after,
	// so give it 5 extra minutes.
	return nextRuntime.plus({ minutes: 5 })
}
