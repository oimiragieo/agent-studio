import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    tools: 'src/tools/index.ts',
    mcp: 'src/mcp/index.ts',
    streaming: 'src/streaming/index.ts',
    permissions: 'src/permissions/index.ts',
    'prompt-engineering': 'src/prompt-engineering/index.ts',
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
