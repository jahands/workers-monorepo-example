import { DurableObject } from 'cloudflare:workers'
import { DateTime } from 'luxon'
import PQueue from 'p-queue'

import { newHTTPException } from '@repo/hono-helpers'

import { getCacheExpiration, parseAllergyRuntime } from './allergyruntime'
import { newLogger } from './helpers/logging'
import { initPlainSentry } from './helpers/sentry'
import { AllergyResponse } from './schema'
import { getWeatherExpiration, parseWeatherTime, weatherAPIUrl, WeatherResponse } from './weather'

import type { SharedAppContext } from '@repo/hono-helpers'
import type { LogData, LogLevel } from '@repo/logging'
import type { Bindings } from './types'

interface AllergyDataCache {
	data: AllergyResponse
	expiresAt: number
}
const allergyDataCacheKey = 'allergyDataCache'

interface WeatherDataCache {
	data: WeatherResponse
	expiresAt: number
}
const weatherDataCacheKey = 'weatheryDataCache'

export class AllergyDO extends DurableObject<Bindings> {
	allergyQueue: PQueue
	weatherQueue: PQueue
	c!: SharedAppContext // definitely set in blockConcurrencyWhile()

	constructor(ctx: DurableObjectState, env: Bindings) {
		super(ctx, env)
		this.allergyQueue = new PQueue({ concurrency: 1 })
		this.weatherQueue = new PQueue({ concurrency: 1 })
		this.ctx.blockConcurrencyWhile(async () => {
			const c: SharedAppContext = {
				env: this.env,
				executionCtx: this.ctx,
				var: {
					sentry: initPlainSentry(this.env, this.ctx),
					logger: undefined,
				},
			}

			c.var.logger = newLogger(c, 'durable_object') // Disabling DO logging for now.
			await c.var.logger.addCFTraceTags(10)
			this.c = c
		})
	}

	async fetch(): Promise<Response> {
		return new Response('not implemented', { status: 400 })
	}

	updateAlarm(): void {
		const doUpdate = async () => {
			const currentAlarm = await this.ctx.storage.getAlarm()
			if (currentAlarm == null || currentAlarm < Date.now()) {
				this.ctx.storage.setAlarm(DateTime.now().plus({ seconds: 5 }).toMillis())
			}
		}
		this.ctx.waitUntil(doUpdate())
	}

	async alarm() {
		await this.c.var.logger?.flush()
	}

	async getAllergyData(): Promise<AllergyResponse> {
		try {
			// this.updateAlarm()

			const data = await this.allergyQueue.add(async () => {
				let start = Date.now()
				const allergyCache = await this.ctx.storage.get<AllergyDataCache>(allergyDataCacheKey)
				if (allergyCache && allergyCache.data && Date.now() < allergyCache.expiresAt) {
					this.c.var.logger?.debug(
						`Used cached allergy data (expires ${DateTime.fromMillis(allergyCache.expiresAt).toRelative()})`,
						{
							duration: Date.now() - start,
						}
					)
					return allergyCache.data
				}

				start = Date.now()
				const res = await fetch(getAllergyUrl(), {
					headers: {
						'User-Agent':
							'twitter.com/jachands / jacob@jacobhands.com - using this to monitor allergies on my Stream Deck <3',
					},
					cf: {
						cacheEverything: true,
						cacheTtl: 300,
					},
				})
				if (!res.ok) throw newHTTPException(500, 'Failed to fetch')
				const d = AllergyResponse.parse(await res.json())
				const fetchDuration = Date.now() - start
				this.c.var.logger?.info(`Fetched allergy data in ${fetchDuration}ms`, {
					duration: fetchDuration,
				})
				const expiration = getCacheExpiration(parseAllergyRuntime(d.runtime))
				this.c.var.logger?.debug(`New allergy data expires ${expiration.toRelative()}`)
				const cachedData: AllergyDataCache = {
					expiresAt: expiration.toMillis(),
					data: d,
				}
				this.ctx.storage.put(allergyDataCacheKey, cachedData)
				return d
			})
			if (!data) throw newHTTPException(500, 'Failed to fetch allergy data')

			const age = DateTime.now().diff(parseAllergyRuntime(data.runtime)).as('hours')
			this.c.var.logger?.debug(`Allergy data is ${age} hours old`)

			if (age > 24) {
				const sentry = this.c.var.sentry
				const capture = (msg: string, level: LogLevel, data?: LogData) => {
					this.c.var.logger?.logWithLevel(msg, level, data)
					sentry?.withScope((scope) => {
						scope.setContext('allergy error context', {
							data: JSON.stringify(data),
						})
						sentry.captureMessage(msg, level)
					})
				}
				capture(`Allergy data is over 24 hours old: ${age}`, 'error')
				const sendToDiscord = async () => {
					const mentionMe = '<@85379843826413568>' // @geostyx
					const discordRes = await fetch(this.env.CRESTVIEW_ALLERGIES_DISCORD_HOOK, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							content: `${mentionMe} ERROR!! Allergy data is over 24 hours old: ${age}`,
						}),
					})
					if (!discordRes.ok) {
						this.c.var.logger?.error(`Failed to send Discord webhook: ${discordRes.status}`)
						capture(`Failed to send Discord webhook: ${discordRes.status}`, 'error', {
							msc: {
								discordRes: {
									status: discordRes.status,
									text: await discordRes.text(),
								},
							},
						})
					}
				}
				this.ctx.waitUntil(sendToDiscord())
			}

			return data
		} catch (e) {
			this.c.var.sentry?.captureException(e)
			throw e
		}
	}

	async getWeatherData(): Promise<WeatherResponse> {
		try {
			// this.updateAlarm()
			const data = await this.weatherQueue.add(async () => {
				let start = Date.now()
				const weatherCache = await this.ctx.storage.get<WeatherDataCache>(weatherDataCacheKey)
				if (weatherCache && Date.now() < weatherCache.expiresAt) {
					const msg = `Used cached weather data (expires ${DateTime.fromMillis(weatherCache.expiresAt).toRelative()})`
					this.c.var.logger?.debug(msg, {
						duration: Date.now() - start,
					})
					console.log(msg)
					return weatherCache.data
				}

				start = Date.now()
				const res = await fetch('https://webproxy.uuid.rocks/api/proxy/open-meteo.com', {
					method: 'POST',
					body: JSON.stringify({ url: weatherAPIUrl }),
					headers: {
						Authorization: 'Bearer supersecret',
						'Content-Type': 'application/json',
					},
					cf: {
						cacheEverything: true,
						cacheTtl: 300,
					},
				})

				if (!res.ok) {
					this.c.var.logger?.error(`Failed to fetch weather data: ${res.status}`, {
						msc: {
							resText: await res.text(),
						},
					})
					throw newHTTPException(500, 'Failed to fetch weather data')
				}
				const d = WeatherResponse.parse(await res.json())
				const fetchDuration = Date.now() - start
				this.c.var.logger?.info(`Fetched weather data in ${fetchDuration}ms`, {
					duration: fetchDuration,
				})

				const expiration = getWeatherExpiration(parseWeatherTime(d.current.time))
				this.c.var.logger?.debug(`New weather data expires ${expiration.toRelative()}`)
				const cachedData: WeatherDataCache = {
					expiresAt: expiration.toMillis(),
					data: d,
				}
				this.ctx.storage.put(weatherDataCacheKey, cachedData)
				return d
			})
			if (!data) throw newHTTPException(500, 'Failed to fetch')
			return data
		} catch (e) {
			this.c.var.sentry?.captureException(e)
			throw e
		}
	}
}

function cacheBreak(): string {
	let now = new Date().getTime()
	now = Math.floor(now / 1000 / 300)
	return '' + now
}

function getAllergyUrl(): string {
	return `https://media.psg.nexstardigital.net/kxan/weather/allergy/hourly_allergy_v8.json?v=${cacheBreak()}`
}
