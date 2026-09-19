import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Spec files share one Postgres + one Redis: parallel files truncate
    // each other's rows mid-test (FK violations, phantom 401s). Run files
    // sequentially; tests within a file are sequential by default.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
