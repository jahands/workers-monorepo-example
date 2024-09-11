import type { Client as NotionClient } from '@notionhq/client'
import type { HonoApp } from '@repo/hono-helpers'
import type { SharedHonoBindings, SharedHonoVariables } from '@repo/hono-helpers/src/types'

export type Bindings = SharedHonoBindings & {
	// axiom: workers-general 1P-72dx8

	/** API token for authing to this Worker 1P-r4irq */
	API_TOKEN: string

	/** Geobot token - 1P-rpdl1 */
	NOTION_API_TOKEN: string
}

/** Variables can be extended */
export type Variables = SharedHonoVariables & {
	notion: NotionClient
}

export interface App extends HonoApp {
	Bindings: Bindings
	Variables: Variables
}
