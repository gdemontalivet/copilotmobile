# Copilot Mobile Implementation Plan

## Goal

Build a mobile-friendly web companion for local VS Code agent sessions. The user should be able to open a secure web page on their phone, watch the agent's responses/progress, and answer prompts or send follow-up messages from the web.

This is not a full VS Code mobile port, and it is not trying to expose the editor UI. The first useful product is a narrow remote conversation surface:

- View the current agent session and status.
- Follow streamed agent responses and tool/progress updates.
- Send a human reply or steering message.
- Answer user-input prompts.
- Approve or deny permission prompts when required.

## Proposed Architecture

```text
Mobile web app
  -> GitHub OAuth
  -> Dev Tunnel discovery/connect
  -> Agent Host WebSocket protocol
  -> Desktop VS Code Agent Host
  -> Local Copilot/agent session
```

Desktop VS Code already has the pieces we want to reuse:

- `TunnelHostService` starts sharing from the workbench.
- `TunnelHostMainService` creates a Dev Tunnel and pipes incoming connections to the local Agent Host socket.
- `AgentHostServiceClient.startWebSocketServer()` starts the local Agent Host protocol server.
- `RemoteAgentHostProtocolClient` is the reference client for the JSON-RPC style protocol.

## Project Shape

Start this folder as an independent web app:

```text
copilotmobile/
  app/                       # Mobile web app source
  packages/
    agent-host-client/        # TypeScript client for VS Code Agent Host protocol
    tunnel-client/            # GitHub auth + Dev Tunnel discovery/connect wrapper
  docs/
    protocol-notes.md
    security-model.md
```

Use TypeScript throughout. A responsive web app is the fastest first target because it works from mobile Safari/Chrome without App Store friction. A native wrapper can come later if needed.

## Milestones

### M0: Local Protocol Spike

Create a Node script that connects to a locally running standalone Agent Host or VS Code-started Agent Host WebSocket.

Deliverables:

- Minimal `AgentHostClient` that performs `initialize`.
- Subscribe to root state.
- List sessions.
- Dispatch one harmless action.

Exit criteria:

- We can prove the mobile app does not need to embed the full VS Code workbench protocol.

### M1: Tunnel Connectivity

Connect to a VS Code-hosted Agent Host through a Dev Tunnel.

Deliverables:

- GitHub OAuth login.
- Tunnel discovery by account.
- Connect to tunnel port `31546`.
- Preserve the existing connection-token validation layer.

Open question:

- Whether the Microsoft Dev Tunnels client SDK works cleanly in React Native. If not, add a tiny broker service or native module only for tunnel relay transport.

### M2: Read-Only Mobile Web UI

Build the first web interface around one active session.

Deliverables:

- Mobile-first session page.
- Transcript/progress rendering.
- Connection status and reconnect behavior.

### M3: Human Replies And Approvals

Add only the actions needed for the human to continue the agent loop.

Deliverables:

- Send a reply/follow-up message.
- Approve/deny permission prompt.
- Answer user-input prompt.

Security requirement:

- Any destructive approval must show the exact command/file/tool request before confirmation.

### M4: Hardening

Make it suitable for daily use.

Deliverables:

- Secure token storage.
- Explicit pairing/revocation.
- Short-lived tunnel/session state.
- Audit log in the app.
- Redaction for secrets in logs.

## Security Model

Use layered security:

- GitHub auth identifies the user and authorizes tunnel discovery/connect.
- Dev Tunnels provide encrypted relay and avoid opening desktop LAN/WAN ports.
- Agent Host connection token remains a per-session secret.
- The web app never receives broad local filesystem access outside what the Agent Host protocol exposes.

Do not expose `serve-web`, the raw VS Code Server, or Agent Host on `0.0.0.0` as the first implementation.

## First Implementation Step

Before scaffolding the web UI, extract or recreate the smallest possible `agent-host-client` package from the VS Code reference client:

- Study `src/vs/platform/agentHost/browser/remoteAgentHostProtocolClient.ts`.
- Study `src/vs/platform/agentHost/common/state/sessionProtocol.ts`.
- Study `src/vs/platform/agentHost/common/state/protocol/messages.ts`.
- Implement only `initialize`, `subscribe`, request/response correlation, and the actions needed for human replies/approvals.

Once that works from Node against a local Agent Host, move the client into the browser app.
