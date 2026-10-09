import { defineConfig } from 'vitest/config';

// Integration tests start real containers (Testcontainers), so they get generous timeouts.
export default defineConfig({
  test: { include: ['test/**/*.int.test.ts'], testTimeout: 120_000, hookTimeout: 180_000, fileParallelism: false },
});
