import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'bash/index': 'src/bash/index.ts',
    'text-editor/index': 'src/text-editor/index.ts',
    'web-fetch/index': 'src/web-fetch/index.ts',
    'memory/index': 'src/memory/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
});
