# Copilot Mobile

Mobile-friendly web companion for the BYOK Copilot Chat fork at
`/Users/guillaume/development/copilot`. M0 (this milestone) ships:

- A Vite + React + TypeScript single-screen mobile UI that streams agent
  responses and exposes a reply box.
- A canonical wire-protocol package (`@copilotmobile/protocol`) consumed by
  both the web app and the BYOK extension.
- A sync script that copies the built bundle and protocol mirror into the
  BYOK extension tree.
- An extension-side bridge (`bridgeServer.ts`, `chatTap.ts`,
  `replyInjector.ts`, `byokRemote.contribution.ts`) installed by Patch 50
  in `apply-byok-patches.sh` over in the `copilot/` repo.

M1+ wires this up to the real `ChatResponseStream`, replies that hit the
actual chat session, and Dev Tunnels for over-the-internet access. See
[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the full roadmap.

## Layout

```
copilotmobile/
  package.json              workspaces root
  protocol/                 shared wire types (@copilotmobile/protocol)
  web/                      Vite + React + TS mobile UI
  scripts/sync-into-extension.ts
                            copies web/dist + protocol into ../copilot
```

## Build pipeline

```bash
cd /Users/guillaume/development/copilotmobile

# One-time:
npm install

# Whenever you touch the mobile UI or the protocol:
npm run build && npm run sync   # === npm run build:sync

# Inside the BYOK fork, install the canonical protocol.ts mirror into src/:
cd /Users/guillaume/development/copilot
bash .github/scripts/apply-byok-patches.sh
```

`npm run build:sync` writes:

- `web/dist/*` -> `copilot/src/extension/byokRemote/dist/`
- `protocol/index.ts` -> `copilot/.github/byok-patches/files/byokRemote/protocol.ts`

The patch script then installs the canonical `protocol.ts` into
`copilot/src/extension/byokRemote/` alongside the other byokRemote source
files.

## M0 LAN smoke test

Once you've installed a fresh VSIX (per the `build-and-deploy` workspace
rule, the maintainer pushes to `main`, CI builds the VSIX, and you install
it manually):

1. **Enable the bridge.** Open VS Code settings and set:

   - `chat.byok.mobileBridge.enabled` -> `true`
   - `chat.byok.mobileBridge.bindHost` -> `0.0.0.0`  *(M0 LAN test only — M3
     replaces this with a Dev Tunnel and you can switch back to the
     `127.0.0.1` default.)*
   - `chat.byok.mobileBridge.port` -> `31547` (default; change if something
     else is on that port).

2. **Run the share command.** `Cmd+Shift+P` -> `Copilot Full BYOK: Share
   chat with mobile`. VS Code shows a notification with the URL
   (`http://<your-lan-ip>:31547/?tkn=<token>`) and a "Copy URL" button.

3. **Open the URL on your phone.** Same Wi-Fi as the desktop. You should
   see a dark-themed transcript that immediately starts streaming
   "[M0 sanity check] Connected to the BYOK mobile bridge..." (canned by
   `chatTap.ts` until M1 wires the real chat stream).

4. **Send a reply.** Type into the composer and tap **Send**. The text
   shows up in the **BYOK Mobile** output channel inside VS Code
   (`replyInjector.ts` in M0; M2 will inject it as a real chat turn).

5. **Stop sharing.** `Cmd+Shift+P` -> `Copilot Full BYOK: Stop sharing
   chat`, or re-run the Share command and pick "Stop sharing".

If the page can't connect, check:

- Phone is on the same Wi-Fi as the desktop.
- The desktop firewall allows inbound on `31547` (macOS prompts on first
  bind to non-loopback).
- The token in the URL hasn't been mangled — copy-paste, don't retype.

## Development server (web only)

For UI iteration without a running bridge:

```bash
cd web
npm run dev   # Vite dev server on http://localhost:5173
```

The dev server points at the same origin's `/events` and `/reply`
endpoints, so during `npm run dev` you'd need a real bridgeServer running
on the same host (or a Vite proxy — not configured in M0; revisit if
needed).

## Auth model (M0)

- Per-server connection token (24 random bytes, base64url-encoded), rotated
  every time the bridge starts.
- Accepted via `?tkn=<token>` query string on every HTTP request and on the
  WebSocket upgrade URL.
- `vscode-tkn` `HttpOnly` cookie set on the first valid request so reloads
  inside the page don't need the query string.
- All HTTP and WS requests without a valid token get a 401.

M5 will add token rotation, idle timeout, an explicit pairing flow, and an
optional GitHub-identity gate.
