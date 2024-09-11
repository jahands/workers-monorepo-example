import { z } from 'zod'

import type { Context } from 'hono'
import type { App } from '../types'

export type SaveLinkRequest = z.infer<typeof SaveLinkRequest>
export const SaveLinkRequest = z.object({
	url: z.string().url('must be a valid url'),
	notes: z.string().optional(),
})

const myLinksDB = {
	id: 'fa2954ff484446b18989b6efbfe26869',
	columns: {
		url: 'URL',
		notes: 'Notes',
		description: 'Description',
	},
} as const

export async function saveLink(c: Context<App>, link: SaveLinkRequest): Promise<Response> {
	const sentry = c.get('sentry')
	let title = ''
	let description = ''

	try {
		const res = await getPageMeta(c, link)
		title = res.title
		description = res.description
	} catch (e) {
		sentry?.captureException(e)
	}

	if (title.length === 0) {
		if (description.length > 0) {
			title = `${new URL(link.url).hostname} - ${description}`
		} else {
			title = link.url
		}
	} else if (title.length < 12 && description.length > 0) {
		title = `${title} - ${description}`
	}

	if (title.length > 120) {
		title = title.substring(0, 120) + '...'
	}

	await c.var.notion.pages.create({
		parent: {
			database_id: myLinksDB.id,
		},
		properties: {
			title: {
				type: 'title',
				title: [{ text: { content: title } }],
			},
			[myLinksDB.columns.url]: {
				type: 'url',
				url: link.url,
			},
			[myLinksDB.columns.notes]: {
				type: 'rich_text',
				rich_text: [{ text: { content: link.notes ?? '' } }],
			},
			[myLinksDB.columns.description]: {
				type: 'rich_text',
				rich_text: [{ text: { content: description } }],
			},
		},
	})
	return c.json({ success: true })
}

async function getPageMeta(
	c: Context<App>,
	link: SaveLinkRequest
): Promise<{ title: string; description: string }> {
	const sentry = c.get('sentry')
	let title = ''
	let description = ''
	const res = await fetch(link.url, {
		headers: {
			'User-Agent':
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
		},
	})

	const ctx = {
		url: link.url,
		status: res.status,
		statusText: res.statusText,
		text: '',
	}
	sentry?.setContext('Fetch Link Response', ctx)
	if (!res.ok) {
		ctx.text = await res.text()
		sentry?.setContext('Fetch Link Response', ctx)

		c.var.logger?.error('Failed to fetch link', {
			msc: ctx,
		})
		sentry?.setContext('Save Link', ctx)
		throw new Error('Failed to fetch link')
	}

	const addDescription = (el: Element) => {
		if (description.length > 0) return // Only want the first description
		const val = el.getAttribute('content')
		if (val && val.length > 0) {
			description = val
		}
	}

	await new HTMLRewriter()
		.on('title', {
			text(text) {
				if (title.length > 0) {
					c.var.logger?.log('url had multiple titles', {
						msc: {
							url: link.url,
							title,
						},
					})
					return
				}
				const nextTitle = text.text.trim()
				if (nextTitle.length > 0) {
					title = nextTitle
				}
			},
		})
		.on('meta[name="description"]', {
			element(el) {
				addDescription(el)
			},
		})
		.on('meta[property="og:description"]', {
			element(el) {
				addDescription(el)
			},
		})
		.on('meta[name="twitter:description"]', {
			element(el) {
				addDescription(el)
			},
		})
		.on('meta[itemprop="description"]', {
			element(el) {
				addDescription(el)
			},
		})
		.transform(res)
		.arrayBuffer()

	// Remove newlines and multiple spaces
	title = title.replace(/\n/g, ' ').replace(/  +/g, ' ').trim()
	return { title, description }
}
