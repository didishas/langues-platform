import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgres://langues:langues@localhost:5432/langues_test'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.spec.ts', 'tests/unit/**/*.spec.tsx'],
        },
      },
      {
        extends: true,
        test: {
          name: 'int',
          environment: 'node',
          setupFiles: ['./vitest.setup.ts'],
          globalSetup: ['./tests/int/globalSetup.ts'],
          include: ['tests/int/**/*.int.spec.ts'],
          env: { DATABASE_URL: testDatabaseUrl, PAYLOAD_SECRET: 'test-secret' },
          testTimeout: 60_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
    ],
  },
})
