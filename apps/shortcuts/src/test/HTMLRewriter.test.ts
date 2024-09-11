import { describe, expect, it } from 'vitest'

describe('HTMLRewriter', () => {
	it('should extract title', async () => {
		const res = await fetch('https://uuid.rocks')
		expect(res.status).toBe(200)
		const values: string[] = []
		await new HTMLRewriter()
			.on('title', {
				text(text) {
					if (values.length > 0) return // Only want the first title
					const title = text.text.trim()
					if (title.length > 0) {
						values.push(title)
					}
				},
			})
			.transform(res)
			.arrayBuffer()
		expect(values).toMatchInlineSnapshot(`
			[
			  "Web-Scale UUID as a Service",
			]
		`)
	})

	it('extracts description', async () => {
		const res = await fetch(
			'https://gist.uuid.rocks/jh/a679ed0259bc4af1b19b70e4b3be5ac5/raw/HEAD/hexos.html'
		)
		expect(res.status).toBe(200)
		const values: string[] = []
		const addContent = (el: Element) => {
			const val = el.getAttribute('content')
			if (val && val.length > 0) {
				values.push(val)
			}
		}
		await new HTMLRewriter()
			.on('meta[name="description"]', {
				element(el) {
					addContent(el)
				},
			})
			.on('meta[property="og:description"]', {
				element(el) {
					addContent(el)
				},
			})
			.on('meta[name="twitter:description"]', {
				element(el) {
					addContent(el)
				},
			})
			.on('meta[itemprop="description"]', {
				element(el) {
					addContent(el)
				},
			})
			.transform(res)
			.arrayBuffer()
		expect(values).toMatchInlineSnapshot(`
				[
				  "The home server OS that is designed for simplicity and lets you regain control over your data and privacy.",
				  "The home server OS that is designed for simplicity and lets you regain control over your data and privacy.",
				  "The home server OS that is designed for simplicity and lets you regain control over your data and privacy.",
				  "The home server OS that is designed for simplicity and lets you regain 
				control over your data and privacy.",
				]
			`)
	})
})
