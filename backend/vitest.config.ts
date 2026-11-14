import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Use forks pool for better WASM (PGlite) compatibility
    pool: 'forks',
    // Increase timeout for PGlite WASM initialization
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

