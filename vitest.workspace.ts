import { defineWorkspace } from 'vitest/config';

// Two projects share one `npm test` runner:
//  - functions: Cloud Functions logic (place reconciliation, directions, mutations)
//  - app: pure client helpers (directions URL builder, day insights)
export default defineWorkspace([
  {
    test: {
      name: 'functions',
      root: './functions',
      include: ['test/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'app',
      root: './StickerSmash',
      include: ['test/**/*.test.ts'],
      environment: 'node',
    },
  },
]);
