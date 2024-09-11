import { DateTime } from 'luxon'

export function getNow() {
	return DateTime.now().setZone('America/Chicago')
}
