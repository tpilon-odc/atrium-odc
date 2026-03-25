import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } }, // tests séquentiels — même DB
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/routes/**/*.ts'],
      exclude: ['src/__tests__/**'],
    },
  },
})
