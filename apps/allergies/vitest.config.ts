import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {},
})

// todo: Figure out how to get AI bindings working

// export default defineWorkersConfig({
// 	test: {
// 		poolOptions: {
// 			workers: {
// 				wrangler: { configPath: './wrangler.toml' },
// 				main: './src/index.ts',
// 				isolatedStorage: true,
// 				singleWorker: true,
// 				miniflare: {
// 					bindings: {
// 						ENVIRONMENT: 'VITEST',
// 					},
// 				},
// 			},
// 		},
// 	},
// })
