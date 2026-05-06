import { useEffect, useRef, useState } from 'react';
import type { ServerEvent } from '@copilotmobile/protocol';
import { eventsWsUrl } from './api';

export type ConnState = 'connecting' | 'open' | 'closed' | 'error';

/**
 * Subscribe to the bridge's `/events` WebSocket with auto-reconnect.
 *
 * The reconnect schedule uses jittered exponential backoff capped at 10s so
 * a phone returning from sleep doesn't hammer the bridge with reconnects.
 */
export function useEvents(onEvent: (ev: ServerEvent) => void): ConnState {
	const [state, setState] = useState<ConnState>('connecting');
	const onEventRef = useRef(onEvent);
	onEventRef.current = onEvent;

	useEffect(() => {
		let socket: WebSocket | null = null;
		let attempt = 0;
		let timer: number | null = null;
		let disposed = false;

		const connect = () => {
			if (disposed) {
				return;
			}
			setState('connecting');
			socket = new WebSocket(eventsWsUrl());

			socket.addEventListener('open', () => {
				attempt = 0;
				setState('open');
			});

			socket.addEventListener('message', (e) => {
				try {
					const parsed = JSON.parse(typeof e.data === 'string' ? e.data : '') as ServerEvent;
					onEventRef.current(parsed);
				} catch {
					// Malformed event — ignored. Real cause should already be in the
					// extension's BYOK Mobile output channel.
				}
			});

			socket.addEventListener('close', () => {
				if (disposed) {
					return;
				}
				setState('closed');
				const delay = Math.min(10_000, 500 * 2 ** attempt) + Math.random() * 250;
				attempt += 1;
				timer = window.setTimeout(connect, delay);
			});

			socket.addEventListener('error', () => {
				setState('error');
			});
		};

		connect();

		return () => {
			disposed = true;
			if (timer !== null) {
				window.clearTimeout(timer);
			}
			socket?.close();
		};
	}, []);

	return state;
}
