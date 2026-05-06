import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `base: './'` is required because the bundle is served from the BYOK
// extension's bridgeServer at the tunnel root with no path prefix, but the
// HTML may also be loaded from `/` with a `?tkn=…` query string. Relative
// asset URLs work in both cases.
export default defineConfig({
	plugins: [react()],
	base: './',
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		sourcemap: false,
		// Keep the bundle small enough to ship inside the VSIX.
		target: 'es2020',
	},
	server: {
		host: true,
		port: 5173,
	},
});
