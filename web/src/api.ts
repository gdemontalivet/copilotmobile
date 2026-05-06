import type { ClientRequest } from '@copilotmobile/protocol';

/**
 * Build a same-origin URL for a bridge endpoint, preserving the `?tkn=` query
 * string the user landed on. The bridgeServer also accepts the token via the
 * `vscode-tkn` cookie that gets set on first load, but we keep the query
 * string explicit so reloading the page from a deep link still works.
 */
function buildUrl(path: string): string {
	const tkn = new URLSearchParams(window.location.search).get('tkn');
	const url = new URL(path, window.location.origin);
	if (tkn) {
		url.searchParams.set('tkn', tkn);
	}
	return url.toString();
}

async function postJson(path: string, body: ClientRequest): Promise<void> {
	const res = await fetch(buildUrl(path), {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		throw new Error(`${path} failed: ${res.status} ${res.statusText}`);
	}
}

export async function postReply(text: string): Promise<void> {
	await postJson('/reply', { type: 'reply', text });
}

export async function postApproval(requestId: string, approved: boolean): Promise<void> {
	await postJson('/approval', { type: 'approval', requestId, approved });
}

/**
 * Build the WebSocket URL for `/events`. Browsers don't send cookies on the
 * upgrade request reliably across all platforms (Mobile Safari is the worst
 * offender), so we always include the token in the query string.
 */
export function eventsWsUrl(): string {
	const tkn = new URLSearchParams(window.location.search).get('tkn');
	const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	const url = new URL(`${proto}//${window.location.host}/events`);
	if (tkn) {
		url.searchParams.set('tkn', tkn);
	}
	return url.toString();
}
