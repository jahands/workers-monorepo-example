import pRetry from 'p-retry'

/** Retry func with standard defaults for this project */
export function retry<T>(fn: () => Promise<T>): Promise<T> {
	return pRetry(fn, { retries: 3, randomize: true, minTimeout: 500 })
}
