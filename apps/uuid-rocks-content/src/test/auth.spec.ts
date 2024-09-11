import { SELF } from 'cloudflare:test'
import { describe, expect, test } from 'vitest'

import '..'

describe('auth (api only)', () => {
	const unauthorized = { error: { message: 'unauthorized' } }
	const notFound = { error: { message: 'not found' } }

	test('404 api route on invalid domain', async () => {
		const res = await SELF.fetch(`https://example.com/api/non-existent-path`)
		expect(res.status).toBe(404)
		expect(await res.json()).toMatchObject(notFound)
	})

	const domains = ['i.uuid.rocks', 'dl.uuid.rocks', 'sh.uuid.rocks']
	for (const domain of domains) {
		describe(domain, async () => {
			describe('404 for correct api key (invalid route)', async () => {
				test('query key', async () => {
					const res = await SELF.fetch(`https://${domain}/api/non-existent-path?key=password`)
					expect(res.status).toBe(404)
					expect(await res.json()).toMatchObject(notFound)
				})

				test('auth header', async () => {
					const res = await SELF.fetch(`https://${domain}/api/non-existent-path`, {
						headers: { Authorization: 'Bearer password' },
					})
					expect(res.status).toBe(404)
					expect(await res.json()).toMatchObject(notFound)
				})
			})

			test('404 for non-api route', async () => {
				const res = await SELF.fetch(`https://${domain}/non-existent-path`)
				expect(res.status).toBe(404)
				expect(await res.json()).toMatchObject(notFound)
			})
		})

		describe('401 for incorrect api key', async () => {
			test(`query key`, async () => {
				const res = await SELF.fetch(`https://${domain}/api/non-existent-path?key=asdf`)
				expect(res.status).toBe(401)
				expect(await res.json()).toMatchObject(unauthorized)
			})

			test(`auth header`, async () => {
				const res = await SELF.fetch(`https://${domain}/api/non-existent-path`, {
					headers: { Authorization: 'Bearer asdf' },
				})
				expect(res.status).toBe(401)
				expect(await res.json()).toMatchObject(unauthorized)
			})
		})

		test('401 for no api key', async () => {
			// empty key
			let res = await SELF.fetch(`https://${domain}/api/non-existent-path?key=`)
			expect(res.status).toBe(401)
			expect(await res.json()).toMatchObject(unauthorized)

			// no key
			res = await SELF.fetch(`https://${domain}/api/non-existent-path`)
			expect(res.status).toBe(401)
			expect(await res.json()).toMatchObject(unauthorized)

			// empty header
			res = await SELF.fetch(`https://${domain}/api/non-existent-path`, {
				headers: { Authorization: '' },
			})
			expect(res.status).toBe(401)
			expect(await res.json()).toMatchObject(unauthorized)

			// no header
			res = await SELF.fetch(`https://${domain}/api/non-existent-path`)
			expect(res.status).toBe(401)
			expect(await res.json()).toMatchObject(unauthorized)
		})
	}
})
