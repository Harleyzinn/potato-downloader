import {defineConfig} from 'vite';
export default defineConfig({
  base: process.env.BATATUBO_DESKTOP ? './' : '/potato-downloader/',
  server: {proxy:{'/api':'http://127.0.0.1:8787'}},
  build: {target:'es2022',outDir:process.env.BATATUBO_DESKTOP?'dist-desktop':'dist'},
});
