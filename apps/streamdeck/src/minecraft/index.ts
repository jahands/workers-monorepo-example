import { newHTTPException } from '@repo/hono-helpers'

import type { Context } from 'hono'
import type { App } from '../types'
import type { MCSrvStatResponse } from './types'

export async function getPlayerOnlineIcon(
	c: Context<App>,
	server: string,
	player: string
): Promise<Response> {
	async function getColor(color: 'red' | 'green' | 'yellow') {
		const res = await fetch(`https://i.uuid.rocks/icons/streamdeck/${color}.jpg`)
		if (!res.ok) {
			throw newHTTPException(500, 'internal server error')
		}
		c.header('Content-Type', 'image/jpeg')
		return c.body(res.body)
	}

	c.header('Cache-Control', 'public, max-age=60')

	const id = c.env.MUTEXFETCHER.idFromName(`minecraft-${server}`)
	const stub = c.env.MUTEXFETCHER.get(id)
	const res = await stub.fetch(`http://mutexfetcher/minecraft/${server}`)

	if (!res.ok) {
		c.var.logger?.error('Failed to fetch server status', {
			msc: {
				status: res.status,
				body: await res.text(),
			},
		})
		throw newHTTPException(500, 'internal server error')
	}

	const data = (await res.json()) as MCSrvStatResponse
	c.var.logger?.debug('Server status', { msc: { data } })
	if (!data.online) {
		return await getColor('yellow')
	}
	const playerOnline =
		data.players.list && data.players.list.map((p) => p.name.toLowerCase()).includes(player)
	return await getColor(playerOnline ? 'green' : 'red')
}
