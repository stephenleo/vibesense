import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
          environment: 'node',
          globals: true,
        },
      },
      {
        test: {
          name: 'webview',
          include: ['test/webview/**/*.test.tsx'],
          environment: 'jsdom',
          globals: true,
        },
      },
    ],
  },
})
