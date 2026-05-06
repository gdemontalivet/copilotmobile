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
		// Stable filenames (no content hash). The bundle is committed into
		// the BYOK extension's `src/extension/byokRemote/dist/` so CI ships
		// it inside the VSIX (the upstream `.gitignore`'s blanket `dist/`
		// rule means we force-add this subtree). With hashed filenames,
		// every rebuild would churn `git status` with rename diffs — stable
		// names produce a clean content diff per asset instead.
		rollupOptions: {
			output: {
				entryFileNames: 'assets/index.js',
				chunkFileNames: 'assets/[name].js',
				assetFileNames: 'assets/[name][extname]',
			},
		},
	},
	server: {
		host: true,
		port: 5173,
	},
});
