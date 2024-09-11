import { isHost } from './types'

import type { Context, Next } from 'hono'
import type { App } from './types'

export async function useHostnameMiddleware(
	c: Context<App, '*'>,
	next: Next
): Promise<void | Response> {
	const host = new URL(c.req.url).host
	if (!isHost(host)) {
		return c.notFound()
	}
	c.set('host', host)
	await next()
}
