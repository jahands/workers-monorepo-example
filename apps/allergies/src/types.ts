import type { HonoApp } from '@repo/hono-helpers'
import type {
	SharedAppContext,
	SharedHonoBindings,
	SharedHonoVariables,
} from '@repo/hono-helpers/src/types'
import type { AllergyDO } from './AllergyDO'

export type Bindings = SharedHonoBindings & {
	// axiom: workers-general 1P-72dx8

	/** API token for authing to this Worker */
	API_TOKEN: string
	/** API token used to share Apple Watch endpoint in Cloudflare demo */
	API_TOKEN_CF: string
	CRESTVIEW_ALLERGIES_DISCORD_HOOK: string

	/** Used to archive allergy/weather data */
	R2: R2Bucket
	AI: AIBinding
	KVCACHE: KVNamespace
	ALLERGYDO: DurableObjectNamespace<AllergyDO>
}

/** Variables can be extended */
export type Variables = SharedHonoVariables

export interface App extends HonoApp {
	Bindings: Bindings
	Variables: Variables
}

/** App context for non-hono things */
export type AppContext = SharedAppContext & {
	env: Bindings
}

// AI types - may be different depending on model
export type Llama3Message = {
	role: 'system' | 'user'
	content: string
}

export type AIBinding = {
	run: (
		modelName: '@cf/meta/llama-3-8b-instruct',
		input: { messages: Llama3Message[] }
	) => Promise<{ response: string }>
}
