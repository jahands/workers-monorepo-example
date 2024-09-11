import { zValidator } from '@hono/zod-validator'
import { instrument } from '@microlabs/otel-cf-workers'
import { Client as NotionClient } from '@notionhq/client'
import { Hono } from 'hono'
import { z } from 'zod'

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
import { saveLink, SaveLinkRequest } from './routes/save-link'

import type { App } from './types'

const app = new Hono<App>()
	.use(
		'*', // Middleware
		useMeta,
		useSentry(initSentry, 'http.server'),
		useAxiomLogger
	)

	.use('*', async (c, next) => {
		// Initialize Notion
		const notion = new NotionClient({
			auth: z.string().min(1).parse(c.env.NOTION_API_TOKEN),
		})
		c.set('notion', notion)
		await next()
	})

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

	.post('/api/save-link', zValidator('json', SaveLinkRequest), async (c) => {
		const link = c.req.valid('json')
		return await saveLink(c, link)
	})

const handler = {
	fetch: app.fetch,
}

export default instrument(handler, getTracingConfig<App>())
