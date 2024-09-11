import { instrument } from '@microlabs/otel-cf-workers'
import { Hono } from 'hono'

import {
	getTracingConfig,
	useAuth,
	useAxiomLogger,
	useMeta,
	useNotFound,
	useOnError,
	useSentry,
} from '@repo/hono-helpers'

import { initSentry } from './helpers/sentry'
import { getPlayerOnlineIcon } from './minecraft'

import type { App } from './types'

export { MutexFetcher } from './MutexFetcher'

const app = new Hono<App>()
	.use(
		'*', // Middleware
		useMeta,
		useSentry(initSentry, 'http.server'),
		useAxiomLogger
	)

	// Hooks
	.onError(useOnError())
	.notFound(useNotFound())

	// Auth all routes
	.use('*', async (c, next) =>
		useAuth({
			token: c.env.API_TOKEN,
			bearerAuth: true,
			queryKey: true,
		})(c, next)
	)

	.get('/minecraft/:server/:player', async (c) => {
		const server = c.req.param('server').toLowerCase()
		const player = c.req.param('player').toLowerCase()
		return await getPlayerOnlineIcon(c, server, player)
	})

	.get('/minecraft/:player', async (c) => {
		const server = 'atm9.geostyx.com' // Default server
		const player = c.req.param('player').toLowerCase()
		return await getPlayerOnlineIcon(c, server, player)
	})

const handler = {
	fetch: app.fetch,
}

export default instrument(handler, getTracingConfig<App>())
