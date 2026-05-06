#!/usr/bin/env -S node --import tsx
/**
 * Copy the built mobile web bundle and the shared wire-protocol types into
 * the BYOK Copilot Chat fork so the bridgeServer can serve them as static
 * assets and the TypeScript compile resolves the `protocol.ts` mirror.
 *
 *   web/dist/*        -> ../copilot/src/extension/byokRemote/dist/
 *   protocol/index.ts -> ../copilot/.github/byok-patches/files/byokRemote/protocol.ts (canonical)
 *
 * The patch script (`apply-byok-patches.sh`, Patch 50) is what eventually
 * installs the canonical `protocol.ts` into `src/extension/byokRemote/` —
 * we go through the canonical copy because the BYOK fork's nightly upstream
 * sync wipes any tracked file that doesn't exist upstream.
 *
 * The destination repo is found relative to this file's location by default
 * (`../../copilot`), or via the `COPILOT_REPO` environment variable.
 *
 * Re-running with no changes is cheap — destination files are byte-compared
 * before overwriting, mirroring `install_byok_file`'s `cmp -s` behavior.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const copilotRepo = process.env.COPILOT_REPO
	? resolve(process.env.COPILOT_REPO)
	: resolve(repoRoot, '..', 'copilot');

if (!existsSync(copilotRepo)) {
	console.error(`copilot repo not found at ${copilotRepo}`);
	console.error(`Set COPILOT_REPO env var to override.`);
	process.exit(1);
}

const webDist = resolve(repoRoot, 'web', 'dist');
const protocolFile = resolve(repoRoot, 'protocol', 'index.ts');

if (!existsSync(webDist)) {
	console.error(`web/dist/ does not exist. Run 'npm run build' first.`);
	process.exit(1);
}
if (!existsSync(protocolFile)) {
	console.error(`protocol/index.ts not found at ${protocolFile}`);
	process.exit(1);
}

const byokRemoteRoot = resolve(copilotRepo, 'src', 'extension', 'byokRemote');
const distDest = resolve(byokRemoteRoot, 'dist');

// Canonical protocol mirror lives under .github/byok-patches/files/byokRemote/
// so apply-byok-patches.sh re-installs it after upstream sync. This script
// writes the canonical copy; the patch script copies it into src/.
const canonicalRoot = resolve(copilotRepo, '.github', 'byok-patches', 'files', 'byokRemote');
const protocolDest = resolve(canonicalRoot, 'protocol.ts');

mkdirSync(byokRemoteRoot, { recursive: true });
mkdirSync(canonicalRoot, { recursive: true });

if (existsSync(distDest)) {
	rmSync(distDest, { recursive: true, force: true });
}
mkdirSync(distDest, { recursive: true });

const PROTOCOL_HEADER = `/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// AUTO-GENERATED — do NOT edit directly.
// Source of truth: /Users/guillaume/development/copilotmobile/protocol/index.ts
// Re-generate via \`npm run sync\` from the copilotmobile repo.

`;

let copiedFiles = 0;
let skippedFiles = 0;

function walkAndCopy(srcDir: string, dstDir: string): void {
	mkdirSync(dstDir, { recursive: true });
	for (const entry of readdirSync(srcDir)) {
		const srcPath = join(srcDir, entry);
		const dstPath = join(dstDir, entry);
		const st = statSync(srcPath);
		if (st.isDirectory()) {
			walkAndCopy(srcPath, dstPath);
		} else if (st.isFile()) {
			const data = readFileSync(srcPath);
			writeFileSync(dstPath, data);
			copiedFiles += 1;
		}
	}
}

walkAndCopy(webDist, distDest);

const protocolSource = readFileSync(protocolFile, 'utf8');
const protocolPayload = PROTOCOL_HEADER + protocolSource;
let protocolWrote = false;
if (existsSync(protocolDest)) {
	const existing = readFileSync(protocolDest, 'utf8');
	if (existing === protocolPayload) {
		skippedFiles += 1;
	} else {
		writeFileSync(protocolDest, protocolPayload);
		protocolWrote = true;
	}
} else {
	writeFileSync(protocolDest, protocolPayload);
	protocolWrote = true;
}

console.log(`copilotmobile sync complete:`);
console.log(`  bundle           -> ${relative(copilotRepo, distDest)} (${copiedFiles} file${copiedFiles === 1 ? '' : 's'})`);
console.log(`  protocol (canon) -> ${relative(copilotRepo, protocolDest)} (${protocolWrote ? 'updated' : 'unchanged'})`);
if (skippedFiles > 0) {
	console.log(`  ${skippedFiles} file${skippedFiles === 1 ? '' : 's'} unchanged`);
}
console.log('');
console.log("Run 'bash .github/scripts/apply-byok-patches.sh' inside the copilot repo to install the canonical protocol.ts into src/extension/byokRemote/.");
