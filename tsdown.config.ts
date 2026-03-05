import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.tsx'],
  format: ['esm', 'cjs'],
  dts: true,
  external: ['react'],
  clean: true,
  platform: 'browser',
});
