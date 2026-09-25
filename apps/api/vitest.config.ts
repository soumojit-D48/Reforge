import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // Some service specs exercise the shared local Postgres/Redis setup;
    // serial files prevent connection pressure from making the health spec
    // time out when the full workspace suite runs.
    fileParallelism: false,
  },
});
