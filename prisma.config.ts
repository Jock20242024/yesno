import { defineConfig } from 'prisma';

export default defineConfig({
  seed: {
    script: 'ts-node --compiler-options {"module":"commonjs"} prisma/seed.ts',
  },
});

