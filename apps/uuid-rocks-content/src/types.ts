import type { HonoApp } from '@repo/hono-helpers'
import type { SharedHonoBindings, SharedHonoVariables } from '@repo/hono-helpers/src/types'

export type Bindings = SharedHonoBindings & {
	// axiom: CR-30 uuid-rocks-content 1P-72dx8

	/** Admin API token 1P-pgk7b */
	API_TOKEN: string

	// Bindings
	R2: R2Bucket
	KV: KVNamespace
}

/** Global Hono variables */
export const Hosts = ['i.uuid.rocks', 'dl.uuid.rocks', 'sh.uuid.rocks'] as const
export type Host = (typeof Hosts)[number]
export function isHost(data: any): data is Host {
	return Hosts.includes(data)
}

export type Variables = SharedHonoVariables & {
	// Some stuff differs by host - this gets set in middleware
	host: Host

	// debug stuff
	r2Hit: boolean
	kvHit: boolean
	cacheHit: boolean
	servedBy: 'r2' | 'kv' | 'cache' | 'unknown'
}

export interface App extends HonoApp {
	Bindings: Bindings
	Variables: Variables
}
