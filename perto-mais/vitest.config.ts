import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    fileParallelism: false,
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: 'rls',
          include: ['tests/rls/**/*.test.ts'],
          environment: 'node',
          testTimeout: 30000,
          hookTimeout: 60000,
          setupFiles: ['tests/rls/load-env.ts'],
        },
      },
    ],
  },
});
