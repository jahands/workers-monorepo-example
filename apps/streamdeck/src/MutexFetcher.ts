import { instrumentDO } from '@microlabs/otel-cf-workers'
import { Hono } from 'hono'
import PQueue from 'p-queue'

import {
	getTracingConfig,
	newHTTPException,
	useAxiomLogger,
	useMeta,
	useNotFound,
	useOnError,
	useSentry,
} from '@repo/hono-helpers'

import { initSentry } from './helpers/sentry'

import type { App, Bindings } from './types'

class MutexFetcherDO implements DurableObject {
	state: DurableObjectState
	env: Bindings
	app: Hono<App>
	queue: PQueue

	constructor(state: DurableObjectState, bindings: Bindings) {
		this.state = state
		this.env = bindings
		this.queue = new PQueue({ concurrency: 1 })
		this.app = new Hono<App>()
			.use(
				'*', // Middleware
				useMeta,
				useSentry(initSentry, 'http.server.durable_object'),
				useAxiomLogger
			)

			// Hooks
			.onError(useOnError())
			.notFound(useNotFound())

			.get('/minecraft/:server', async (c) => {
				const server = c.req.param('server')
				const res = await this.queue.add(() =>
					fetch(`https://api.mcsrvstat.us/3/${server}`, {
						headers: {
							'User-Agent': 'twitter.com/jachands',
						},
						cf: { cacheTtl: 60 },
					})
				)
				if (!res) throw newHTTPException(500, 'Failed to fetch')
				return c.body(res.body, res)
			})
	}

	async fetch(request: Request): Promise<Response> {
		return this.app.fetch(request, this.env, {
			passThroughOnException: () => {
				return
			},
			waitUntil: this.state.waitUntil.bind(this.state),
		})
	}
}

export const MutexFetcher = instrumentDO(MutexFetcherDO, getTracingConfig())
