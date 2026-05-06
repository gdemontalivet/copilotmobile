import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { ServerEvent } from '@copilotmobile/protocol';
import { postApproval, postReply } from './api';
import { useEvents } from './useEvents';

interface Message {
	id: string;
	role: 'assistant' | 'user';
	text: string;
	completed: boolean;
}

interface ToolEvent {
	toolId: string;
	name: string;
	summary: string;
	ok?: boolean;
	completed: boolean;
}

interface ApprovalEvent {
	requestId: string;
	kind: string;
	details: string;
}

interface SessionInfo {
	sessionId: string;
	title: string;
	model: string;
}

type TimelineItem =
	| { kind: 'message'; data: Message }
	| { kind: 'tool'; data: ToolEvent }
	| { kind: 'approval'; data: ApprovalEvent };

interface State {
	session: SessionInfo | null;
	timeline: TimelineItem[];
}

type Action =
	| { type: 'event'; event: ServerEvent }
	| { type: 'approval-resolved'; requestId: string };

const initial: State = { session: null, timeline: [] };

function reduce(state: State, action: Action): State {
	if (action.type === 'approval-resolved') {
		return {
			...state,
			timeline: state.timeline.filter(
				(item) => !(item.kind === 'approval' && item.data.requestId === action.requestId),
			),
		};
	}

	const ev = action.event;
	switch (ev.type) {
		case 'hello':
			return {
				...state,
				session: { sessionId: ev.sessionId, title: ev.title, model: ev.model },
			};
		case 'message.started':
			return {
				...state,
				timeline: [
					...state.timeline,
					{ kind: 'message', data: { id: ev.id, role: ev.role, text: '', completed: false } },
				],
			};
		case 'message.delta':
			return {
				...state,
				timeline: state.timeline.map((item) => {
					if (item.kind !== 'message' || item.data.id !== ev.id) {
						return item;
					}
					return { kind: 'message', data: { ...item.data, text: item.data.text + ev.text } };
				}),
			};
		case 'message.completed':
			return {
				...state,
				timeline: state.timeline.map((item) => {
					if (item.kind !== 'message' || item.data.id !== ev.id) {
						return item;
					}
					return { kind: 'message', data: { ...item.data, completed: true } };
				}),
			};
		case 'tool.started':
			return {
				...state,
				timeline: [
					...state.timeline,
					{
						kind: 'tool',
						data: { toolId: ev.toolId, name: ev.name, summary: ev.summary, completed: false },
					},
				],
			};
		case 'tool.completed':
			return {
				...state,
				timeline: state.timeline.map((item) => {
					if (item.kind !== 'tool' || item.data.toolId !== ev.toolId) {
						return item;
					}
					return {
						kind: 'tool',
						data: { ...item.data, summary: ev.summary, ok: ev.ok, completed: true },
					};
				}),
			};
		case 'approval.required':
			return {
				...state,
				timeline: [
					...state.timeline,
					{
						kind: 'approval',
						data: { requestId: ev.requestId, kind: ev.kind, details: ev.details },
					},
				],
			};
		default: {
			const _exhaustive: never = ev;
			return _exhaustive;
		}
	}
}

export function App() {
	const [state, dispatch] = useReducer(reduce, initial);
	const [draft, setDraft] = useState('');
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const transcriptRef = useRef<HTMLDivElement>(null);

	const onEvent = useCallback((event: ServerEvent) => {
		dispatch({ type: 'event', event });
	}, []);

	const conn = useEvents(onEvent);

	useEffect(() => {
		const el = transcriptRef.current;
		if (el) {
			el.scrollTop = el.scrollHeight;
		}
	}, [state.timeline]);

	const send = useCallback(async () => {
		const text = draft.trim();
		if (!text) {
			return;
		}
		setSending(true);
		setError(null);
		try {
			await postReply(text);
			setDraft('');
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Reply failed');
		} finally {
			setSending(false);
		}
	}, [draft]);

	const onApproval = useCallback(async (requestId: string, approved: boolean) => {
		try {
			await postApproval(requestId, approved);
			dispatch({ type: 'approval-resolved', requestId });
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Approval failed');
		}
	}, []);

	return (
		<div className="app">
			<header className="hdr">
				<div className="hdr-row">
					<span className="hdr-title">{state.session?.title ?? 'Copilot Mobile'}</span>
					<ConnDot state={conn} />
				</div>
				{state.session && <div className="hdr-sub">model: {state.session.model}</div>}
			</header>

			<main className="transcript" ref={transcriptRef}>
				{state.timeline.length === 0 && conn === 'open' && (
					<div className="empty">Waiting for the first response…</div>
				)}
				{state.timeline.length === 0 && conn !== 'open' && (
					<div className="empty">Connecting to your VS Code…</div>
				)}
				{state.timeline.map((item, idx) => {
					if (item.kind === 'message') {
						return <MessageView key={`m-${item.data.id}`} message={item.data} />;
					}
					if (item.kind === 'tool') {
						return <ToolView key={`t-${item.data.toolId}-${idx}`} tool={item.data} />;
					}
					return (
						<ApprovalView
							key={`a-${item.data.requestId}`}
							approval={item.data}
							onAnswer={onApproval}
						/>
					);
				})}
			</main>

			<footer className="composer">
				{error && <div className="err" onClick={() => setError(null)}>{error}</div>}
				<div className="composer-row">
					<textarea
						className="input"
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						placeholder="Reply to the agent…"
						rows={2}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
								e.preventDefault();
								void send();
							}
						}}
					/>
					<button
						className="send"
						type="button"
						onClick={() => void send()}
						disabled={sending || draft.trim().length === 0}
					>
						{sending ? '…' : 'Send'}
					</button>
				</div>
			</footer>
		</div>
	);
}

function ConnDot({ state }: { state: ReturnType<typeof useEvents> }) {
	const label =
		state === 'open' ? 'connected' :
		state === 'connecting' ? 'connecting…' :
		state === 'closed' ? 'reconnecting…' : 'error';
	return (
		<span className={`conn conn-${state}`} title={label}>
			<span className="conn-dot" />
			{label}
		</span>
	);
}

function MessageView({ message }: { message: Message }) {
	return (
		<div className={`msg msg-${message.role}`}>
			<div className="msg-text">
				{message.text}
				{!message.completed && <span className="caret">▍</span>}
			</div>
		</div>
	);
}

function ToolView({ tool }: { tool: ToolEvent }) {
	return (
		<div className={`tool ${tool.completed ? (tool.ok === false ? 'tool-bad' : 'tool-ok') : 'tool-pending'}`}>
			<span className="tool-name">{tool.name}</span>
			<span className="tool-summary">{tool.summary}</span>
		</div>
	);
}

function ApprovalView({
	approval,
	onAnswer,
}: {
	approval: ApprovalEvent;
	onAnswer: (requestId: string, approved: boolean) => void;
}) {
	return (
		<div className="approval">
			<div className="approval-title">{approval.kind}</div>
			<div className="approval-details">{approval.details}</div>
			<div className="approval-row">
				<button type="button" className="btn deny" onClick={() => onAnswer(approval.requestId, false)}>
					Deny
				</button>
				<button type="button" className="btn approve" onClick={() => onAnswer(approval.requestId, true)}>
					Approve
				</button>
			</div>
		</div>
	);
}
