import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    watch: { ignored: ['**/release/**', '**/dist-electron/**'] },
  },
});
