import { defineConfig } from 'vitest/config';
import path from 'node:path';
import fs from 'node:fs';

export default defineConfig({
  resolve: { alias: { '@': path.resolve('.') } },
  plugins: [
    {
      name: 'txt-as-string',
      enforce: 'pre',
      load(id) {
        if (id.endsWith('.txt')) return `export default ${JSON.stringify(fs.readFileSync(id, 'utf8'))};`;
      },
    },
  ],
  test: { include: ['tests/**/*.unit.ts'], environment: 'node' },
});
