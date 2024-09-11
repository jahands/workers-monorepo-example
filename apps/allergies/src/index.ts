import { zValidator } from '@hono/zod-validator'
import { instrument } from '@microlabs/otel-cf-workers'
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
	validateEnv,
} from '@repo/hono-helpers'

import { newLogger } from './helpers/logging'
import { initHonoSentry, initPlainSentry } from './helpers/sentry'
import * as routes from './routes'
import { WeatherType } from './weather'

import type { App, AppContext, Bindings } from './types'

export { AllergyDO } from './AllergyDO'

const app = new Hono<App>()
	.use(
		'*', // Middleware
		useMeta,
		useSentry(initHonoSentry, 'http.server'),
		useAxiomLogger
	)

	// Hooks
	.onError(useOnError())
	.notFound(useNotFound())

	.use('*', async (c, next) => {
		validateEnv([
			[c.env.API_TOKEN, 'stringMin1', 'API_TOKEN'],
			[c.env.API_TOKEN_CF, 'stringMin1', 'API_TOKEN_CF'],
			[
				c.env.CRESTVIEW_ALLERGIES_DISCORD_HOOK,
				'discordWebhook',
				'CRESTVIEW_ALLERGIES_DISCORD_HOOK',
			],
			[c.env.CRESTVIEW_ALLERGIES_DISCORD_HOOK, 'stringMin1', 'CRESTVIEW_ALLERGIES_DISCORD_HOOK'],
			[c.env.R2, 'r2Bucket', 'R2 bucket'],
			[c.env.AI, 'aiBinding', 'AI binding'],
			[c.env.KVCACHE, 'kvNamespace', 'KVCache namespace'],
			[c.env.ALLERGYDO, 'durableObject', 'ALLERGYDO namespace'],
		])
		await next()
	})

	// Routes with no auth
	.get('/install', (c) =>
		c.redirect('https://www.icloud.com/shortcuts/ed329faefdbd456f9bd08e14d4225b8a')
	)
	.get('/', (c) => c.text('Coming soon!'))

	// Routes with custom auth

	// Apple Shortcut route shared with CF.
	// Only supports Austin right now.
	.get(
		'/api/report/austin/apple-shortcut',
		async (c, next) =>
			useAuth({
				token: [c.env.API_TOKEN, c.env.API_TOKEN_CF],
				bearerAuth: true,
				queryKey: true,
			})(c, next),
		routes.getAllergyReportAppleShortcut
	)

	// Standard auth for all other routes with private API token
	.use('*', async (c, next) =>
		useAuth({
			token: c.env.API_TOKEN,
			bearerAuth: true,
			queryKey: true,
		})(c, next)
	)

	.get('/api/report', routes.getAllergyReport)

	.post('/api/report-to-discord', async (c) => {
		await routes.reportToDiscord(c)
		return c.text('ok')
	})

	// Streamdeck APIs
	.get('/api/streamdeck/updated', routes.getLastUpdateTime)
	.get(
		'/api/streamdeck/sorted/:index',
		zValidator(
			'param',
			z.object({
				index: z.coerce.number(),
			})
		),
		async (c) => {
			const { index } = c.req.valid('param')
			return await routes.getTopNAllergy(c, index)
		}
	)

	// Weather APIs
	.get(
		'/api/streamdeck/weather/:type',
		zValidator(
			'param',
			z.object({
				type: WeatherType,
			})
		),
		async (c) => {
			const { type } = c.req.valid('param')
			return await routes.getWeatherForStreamDeck(c, type)
		}
	)

	// OTHER JUNK

	// Does anything use this? I don't think so..
	.get(
		'/api/allergy/:allergyType',
		zValidator(
			'param',
			z.object({
				allergyType: z.string(),
			})
		),
		async (c) => {
			const { allergyType } = c.req.valid('param')
			return await routes.getAllergy(c, allergyType)
		}
	)

async function scheduled(_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
	const c: AppContext = {
		executionCtx: ctx,
		env,
		var: {
			sentry: initPlainSentry(env, ctx),
			logger: undefined,
		},
	}
	c.var.logger = newLogger(c, 'scheduled')
	await routes.reportToDiscord(c)
}

const handler = {
	fetch: app.fetch,
}

const instrumentedHandlers = instrument(handler, getTracingConfig<App>())
export default {
	fetch: instrumentedHandlers.fetch,
	scheduled,
}
