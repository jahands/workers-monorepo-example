import { zValidator } from '@hono/zod-validator'
import { instrument } from '@microlabs/otel-cf-workers'
import { Hono } from 'hono'
import { z } from 'zod'

import {
	getTracingConfig,
	useAxiomLogger,
	useMeta,
	useNotFound,
	useOnError,
	useSentry,
} from '@repo/hono-helpers'

import { initSentry } from './helpers/sentry'

import type { App } from './types'

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

	.get(
		'/dl/:file{.+}',
		zValidator(
			'param',
			z.object({
				file: z.string().min(1),
			})
		),
		async (c) => {
			const file = c.req.param('file')
			const res = await fetch(`https://dl.uuid.rocks/${file}`, {
				cf: {
					cacheEverything: true,
					cacheTtlByStatus: {
						'200-299': 604800, // 1 week
					},
				},
			})
			return c.body(res.body, res)
		}
	)

const handler = {
	fetch: app.fetch,
}

export default instrument(handler, getTracingConfig<App>())
