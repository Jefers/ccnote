import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/cnotes/',
  test: {
    environment: 'node',
  },
});
