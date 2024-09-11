import { instrument } from '@microlabs/otel-cf-workers'
import { Hono } from 'hono'

import {
	getTracingConfig,
	newHTTPException,
	useAuth,
	useAxiomLogger,
	useCache,
	useDefaultCors,
	useMeta,
	useNotFound,
	useOnError,
	useSentry,
} from '@repo/hono-helpers'

import { getR2Objects } from './helpers/r2'
import { initSentry } from './helpers/sentry'
import { useHostnameMiddleware } from './middleware'
import { getFromStorage, getFromStorageNoCache } from './routes'

import type { App } from './types'

const app = new Hono<App>()
	.use(
		'*', // Middleware
		useMeta,
		useDefaultCors(),
		useSentry(initSentry, 'http.server'),
		useAxiomLogger,
		useHostnameMiddleware
	)

	// Hooks
	.onError(useOnError())
	.notFound(useNotFound())

	// Routes
	.use('/api/*', async (c, next) =>
		useAuth({
			token: c.env.API_TOKEN,
			queryKey: true,
			bearerAuth: true,
		})(c, next)
	)
	.get('/api/images/:prefix{.+}', useCache(120), async (c) => {
		const prefix = c.req.param('prefix')
		const r2Prefix = `IMAGES/${prefix}`
		const r2Objects = await getR2Objects(c.env.R2, r2Prefix)
		const images = r2Objects.map((o) => `https://i.uuid.rocks/${o.key.substring('IMAGES/'.length)}`)
		return c.text(images.join('\n'))
	})

	.get('/api/images', useCache(120), async (c) => {
		const r2Prefix = `IMAGES/`
		const r2Objects = await getR2Objects(c.env.R2, r2Prefix)
		const images = r2Objects.map((o) => `https://i.uuid.rocks/${o.key.substring('IMAGES/'.length)}`)
		return c.text(images.join('\n'))
	})

	.get('/*', async (c) => {
		switch (
			c.get('host') // Make sure to add new hosts to Hosts type
		) {
			case 'i.uuid.rocks':
				return getFromStorage(c, 'IMAGES')
			case 'dl.uuid.rocks':
				return getFromStorage(c, 'DOWNLOADS')
			case 'sh.uuid.rocks':
				return getFromStorageNoCache(c, 'SCRIPTS', '.sh')
			default:
				throw newHTTPException(400, 'bad request')
		}
	})

const handler = {
	fetch: app.fetch,
}

export default instrument(handler, getTracingConfig<App>())
