import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Eraser, Sparkles, MessagesSquare, Info } from 'lucide-react';
import { groqChat, isAiConfigured, type GroqMessage } from '../lib/ai';
import { buildSnapshot } from '../lib/aiContext';
import { AGENT_TOOLS, executeTool, type AgentActions } from '../lib/aiTools';
import { dbGet, dbSet } from '../lib/localDb';
import Markdown from './Markdown';
import logo2 from '../assets/images/logo2.png';

interface AssistantModuleProps {
  actions: AgentActions;
  readOnly?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

type Mode = 'ask' | 'agent';

const CHAT_KEY = 'samdani_assistant_chat';

const TOOL_LABELS: Record<string, string> = {
  read_data: 'Reading live records…',
  create_student: 'Creating student…',
  update_student: 'Updating student…',
  delete_student: 'Deleting student…',
  record_fee_payment: 'Recording fee payment…',
  add_loan: 'Adding loan entry…',
};

function compactRequestMessages(messages: GroqMessage[]): GroqMessage[] {
  const system = messages.find((message) => message.role === 'system');
  const nonSystem = messages.filter((message) => message.role !== 'system');
  const lastUserIndex = nonSystem.reduce((index, message, currentIndex) => message.role === 'user' ? currentIndex : index, -1);
  const previous = nonSystem.slice(Math.max(0, lastUserIndex - 3), lastUserIndex);
  const active = lastUserIndex >= 0 ? nonSystem.slice(lastUserIndex) : nonSystem.slice(-4);
  const compact = (message: GroqMessage): GroqMessage => ({
    ...message,
    content: message.content == null ? null : message.content.slice(0, message.role === 'tool' ? 1800 : 1400),
  });
  return [
    ...(system ? [{ ...system, content: system.content?.slice(0, 6500) ?? '' }] : []),
    ...[...previous, ...active].map(compact).slice(-8),
  ];
}

function askSystem(snapshot: string): string {
  return `You are "Samdania AI Assistant" — the intelligent assistant of Samdania Talimul Islam Madrasah management system (admin@madrasah.com panel). You have COMPLETE, LIVE, exact knowledge of the ENTIRE school database via the context below. You know every student, every invoice, every ledger entry, every teacher, salary, result, loan and attendance record down to the last detail — more precisely than any human.

Answer the administrator's questions accurately, elegantly and concisely using Markdown (headings, tables, lists, bold, code where useful). Respond in the SAME language the user writes in (Bengali, Arabic or English — a natural mix is perfectly fine). Never invent data — use ONLY the provided context. If asked to summarise, compute totals precisely from the data.

If the user wants to CREATE, UPDATE or DELETE a record (e.g. add a student, collect a fee), tell them to switch to **Agent Mode (الوضع الوكيل)** where you can perform those actions automatically.

--- LIVE DATABASE CONTEXT ---
${snapshot}`;
}

function agentSystem(snapshot: string): string {
  return `You are "Samdania AI Assistant" operating in AGENT MODE for Samdania Talimul Islam Madrasah. You can READ and MODIFY the school database using tools, and you know the entire database precisely. Read live data when needed. For any create, update, delete, payment, or loan action, prepare the tool call but wait for the administrator's visible Approve button before the system executes it.

Rules:
- ALWAYS verify the required data is complete and correct BEFORE acting. If a required field is missing or unclear, DO NOT guess — politely ask the administrator for it, then act once provided.
- For any read, use the read_data tool so you always use live data.
- Perform writes only after the application displays the proposed action and the administrator approves it. Never bypass approval.
- After acting, give a short, elegant Markdown summary of what changed.
- Respond in the same language the user writes in (Bengali / Arabic / English).
- Tools: read_data, create_student, update_student, delete_student, record_fee_payment, add_loan.

--- LIVE DATABASE CONTEXT ---
${snapshot}`;
}

export default function AssistantModule({ actions, readOnly }: AssistantModuleProps) {
  const effectiveReadOnly = Boolean(readOnly);
  const [mode, setMode] = useState<Mode>(effectiveReadOnly ? 'ask' : 'agent');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [toolActivity, setToolActivity] = useState('');
  const [configured] = useState(isAiConfigured());
  const [approval, setApproval] = useState<{ name: string; argumentsText: string } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const approvalResolver = useRef<((approved: boolean) => void) | null>(null);

  const bgUrl = new URL('../assets/images/madrasha .jpg', import.meta.url).href;

  useEffect(() => {
    try {
      const saved = dbGet(CHAT_KEY);
      if (Array.isArray(saved)) setMessages(saved as ChatMessage[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      dbSet(CHAT_KEY, messages);
    } catch {
      /* ignore */
    }
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking, toolActivity]);

  const requestApproval = useCallback((name: string, args: string) => new Promise<boolean>((resolve) => {
    approvalResolver.current = resolve;
    setApproval({ name, argumentsText: args });
  }), []);

  const resolveApproval = (approved: boolean) => {
    const resolve = approvalResolver.current;
    approvalResolver.current = null;
    setApproval(null);
    resolve?.(approved);
  };

  const send = useCallback(
    async (raw?: string) => {
      if (busyRef.current) return;
      const text = (raw ?? input).trim();
      if (!text || !configured) return;

      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
      const current = [...messages, userMsg];
      setMessages(current);
      setInput('');
      setThinking(true);
      setToolActivity('Thinking…');
      busyRef.current = true;

      try {
        const snapshot = buildSnapshot(7000).text;
        const system = mode === 'ask' ? askSystem(snapshot) : agentSystem(snapshot);
        const history: GroqMessage[] = current.slice(-7, -1).map((m) => ({
          role: m.role,
          content: m.content.slice(-1600),
        }));
        let working: GroqMessage[] = [
          { role: 'system', content: system },
          ...history,
          { role: 'user', content: text },
        ];

        let finalText = '';
        let guard = 0;
        while (guard++ < 8) {
          const resp = await groqChat({
            messages: compactRequestMessages(working),
            tools: mode === 'agent' ? AGENT_TOOLS : undefined,
            temperature: 0.2,
            maxTokens: 500,
          });

          if (resp.tool_calls && resp.tool_calls.length) {
            working = [
              ...working,
              { role: 'assistant', content: resp.content, tool_calls: resp.tool_calls },
            ];
            for (const tc of resp.tool_calls) {
              setToolActivity(TOOL_LABELS[tc.function.name] ?? `Using ${tc.function.name}…`);
              const mutatingTool = ['create_student', 'update_student', 'delete_student', 'record_fee_payment', 'add_loan'].includes(tc.function.name);
              const approved = !mutatingTool || await requestApproval(tc.function.name, tc.function.arguments);
              if (!approved) {
                working = [
                  ...working,
                  { role: 'tool', tool_call_id: tc.id, content: 'The administrator cancelled this action. Do not execute it.' },
                ];
                continue;
              }
              const result = executeTool(
                { name: tc.function.name, arguments: tc.function.arguments },
                actions
              );
              working = [
                ...working,
                { role: 'tool', tool_call_id: tc.id, content: result.content },
              ];
            }
            continue;
          }

          finalText = resp.content ?? '_（no response）_';
          break;
        }

        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', content: finalText },
        ]);
      } catch (e: any) {
        const msg = e?.message || 'Unknown error';
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            content: '⚠️ **Error:** ' + msg + '\n\nPlease check the .env Groq configuration and try again.',
            error: true,
          },
        ]);
      } finally {
        setThinking(false);
        setToolActivity('');
        busyRef.current = false;
      }
    },
    [input, messages, configured, mode, actions]
  );

  const clearChat = () => {
    setMessages([]);
    try {
      dbSet(CHAT_KEY, []);
    } catch {
      /* ignore */
    }
  };

  const suggestions = mode === 'ask' ? SUGGESTIONS_ASK : SUGGESTIONS_AGENT;
  const inputDisabled = thinking || !configured;

  return (
    <div className="relative min-h-[calc(100vh-9rem)] rounded-2xl overflow-hidden border border-neutral-200 bg-white shadow-[0_2px_20px_rgba(0,0,0,0.05)]">
      {/* Subtle background image (distinct, but never overpowering) */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-[0.08] pointer-events-none"
        style={{ backgroundImage: `url(${bgUrl})` }}
      />
      <div className="absolute inset-0 bg-[#fafaf8]/85 pointer-events-none" />

      <div className="relative flex flex-col h-[calc(100vh-9rem)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-neutral-200 bg-white/80">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden flex items-center justify-center">
              <img src={logo2} alt="Samdania Madrasah" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <h2 className="text-base font-serif font-bold text-neutral-900 leading-tight">
                Samdania AI Assistant
              </h2>
              <p className="text-[11px] text-neutral-500 font-medium">
                Intelligent school companion · admin@madrasah.com
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex border border-neutral-300 rounded-lg overflow-hidden">
              <button
                onClick={() => !effectiveReadOnly && setMode('ask')}
                disabled={effectiveReadOnly}
                className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  mode === 'ask' ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600'
                }`}
              >
                <MessagesSquare className="h-3.5 w-3.5" />
                Ask
              </button>
              <button
                onClick={() => !effectiveReadOnly && setMode('agent')}
                disabled={effectiveReadOnly}
                className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  mode === 'agent' ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Agent
              </button>
            </div>
            <button
              onClick={() => setShowHelp(true)}
              title="AI help and troubleshooting"
              className="p-2 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100 cursor-pointer"
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              onClick={clearChat}
              title="Clear conversation"
              className="p-2 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100 cursor-pointer"
            >
              <Eraser className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Mode hint */}
        <div className="px-5 py-1.5 border-b border-neutral-100 bg-white/60 text-[11px] text-neutral-500">
          {effectiveReadOnly ? (
            <span>Viewer mode — read-only. Ask Mode only.</span>
          ) : mode === 'ask' ? (
            <span>
              <strong className="text-neutral-700">Ask Mode:</strong> ask anything about students,
              invoices, finance, loans or attendance. Switch to{' '}
              <strong className="text-neutral-700">Agent</strong> to let the assistant manage the
              database automatically.
            </span>
          ) : (
            <span>
              <strong className="text-neutral-700">Agent Mode:</strong> the assistant reads live data,
              checks required fields, then waits for your <strong className="text-neutral-700">Approve &amp; Apply</strong> button before any change. Missing information must be provided first.
            </span>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
          {!configured && (
            <div className="mx-auto max-w-xl border border-neutral-300 bg-white rounded-xl p-4 text-sm text-neutral-700 shadow-sm">
              <p className="font-semibold mb-1">Groq AI is not configured.</p>
              <p className="text-neutral-500 text-[13px]">
                Add <code className="bg-neutral-100 px-1 rounded">VITE_GROQ_API_KEY</code>,{' '}
                <code className="bg-neutral-100 px-1 rounded">VITE_GROQ_BASE_URL</code> and{' '}
                <code className="bg-neutral-100 px-1 rounded">VITE_GROQ_MODEL</code> to your{' '}
                <code className="bg-neutral-100 px-1 rounded">.env</code> file, then restart the dev server.
              </p>
            </div>
          )}

          {configured && messages.length === 0 && (
            <div className="mx-auto max-w-xl text-center py-10">
              <div className="mx-auto h-14 w-14 rounded-2xl border border-neutral-200 bg-white shadow-sm flex items-center justify-center mb-4">
                <img src={logo2} alt="Samdania Madrasah" className="h-10 w-10 object-contain" />
              </div>
              <h3 className="text-xl font-serif font-bold text-neutral-900">Samdania AI Assistant</h3>
              <p className="text-sm text-neutral-500 mt-1.5">
                Your intelligent school-management companion. Ask anything, or switch to Agent Mode to
                let the assistant manage records for you — automatically and accurately.
              </p>
            </div>
          )}

          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] bg-neutral-900 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap shadow-sm">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex justify-start">
                <div
                  className={`max-w-[90%] bg-white rounded-2xl rounded-bl-sm px-4 py-3 border shadow-sm ${
                    m.error ? 'border-red-300' : 'border-neutral-200'
                  }`}
                >
                  <Markdown content={m.content} />
                </div>
              </div>
            )
          )}

          {/* Thinking box (distinct, no animation) */}
          {thinking && (
            <div className="flex justify-start">
              <div className="max-w-[90%] bg-white rounded-2xl rounded-bl-sm px-4 py-3 border border-neutral-200 shadow-sm flex items-center gap-3">
                <img src={logo2} alt="" className="h-6 w-6 object-contain opacity-80" />
                <div className="flex flex-col">
                  <span className="text-[13px] text-neutral-700 font-semibold">Samdania AI is thinking…</span>
                  {toolActivity && toolActivity !== 'Thinking…' && (
                    <span className="text-[11px] text-neutral-400">{toolActivity}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggestions */}
        {messages.length === 0 && configured && (
          <div className="px-4 sm:px-6 pb-2 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => void send(s)}
                className="text-[12px] border border-neutral-300 rounded-full px-3 py-1.5 text-neutral-600 hover:bg-neutral-900 hover:text-white cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-neutral-200 bg-white/80 px-4 sm:px-6 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              disabled={inputDisabled}
              placeholder={
                mode === 'ask'
                  ? 'Ask anything about the school…'
                  : 'Tell me what to do (e.g. create a student)…'
              }
              className="flex-1 resize-none border border-neutral-300 rounded-xl px-4 py-2.5 text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 bg-white disabled:bg-neutral-50 disabled:text-neutral-400"
            />
            <button
              onClick={() => void send()}
              disabled={inputDisabled || !input.trim()}
              className="h-11 px-4 rounded-xl bg-neutral-900 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              <Send className="h-4 w-4" />
              Send
            </button>
          </div>
        </div>

        {approval && (
          <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 p-5">
              <h3 className="font-bold text-neutral-900">Approve AI action?</h3>
              <p className="text-xs text-neutral-500 mt-1">The AI wants to run: <strong>{TOOL_LABELS[approval.name] || approval.name}</strong></p>
              <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-neutral-100 p-3 text-[11px] text-neutral-700 whitespace-pre-wrap">{approval.argumentsText}</pre>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => resolveApproval(false)} className="px-4 py-2 rounded-lg border border-neutral-300 text-xs font-bold">Cancel</button>
                <button onClick={() => resolveApproval(true)} className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-xs font-bold">Approve &amp; Apply</button>
              </div>
            </div>
          </div>
        )}
        {showHelp && (
          <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 p-5 space-y-4">
              <div className="flex items-center justify-between"><h3 className="font-bold text-neutral-900">AI Help &amp; Troubleshooting</h3><button onClick={() => setShowHelp(false)} className="text-neutral-500 text-lg" title="Close">×</button></div>
              <div className="text-xs text-neutral-700 space-y-2">
                <p><strong>Creating or editing:</strong> provide all required information. For a new student, include name, roll, class, guardian phone, and father name. The AI will then show an approval dialog.</p>
                <p><strong>Approval:</strong> review the proposed change and press <strong>Approve &amp; Apply</strong>. Press <strong>Cancel</strong> to prevent any database change.</p>
                <p><strong>Model error:</strong> open <a className="text-blue-700 underline" href="https://console.groq.com/docs/models" target="_blank" rel="noreferrer">Groq Models</a>, choose a model available to your account, set it as <code>VITE_GROQ_MODEL</code> in <code>.env</code>, and restart the Vite server.</p>
                <p><strong>Request too large:</strong> start a new conversation with the clear button, ask one task at a time, and use a specific student name or ID. Detailed records are loaded only when needed.</p>
                <p><strong>Network or key error:</strong> confirm <code>VITE_GROQ_API_KEY</code> and <code>VITE_GROQ_BASE_URL=https://api.groq.com/openai/v1</code>, then restart the development server.</p>
              </div>
              <button onClick={() => setShowHelp(false)} className="w-full bg-neutral-900 text-white rounded-lg py-2 text-xs font-bold">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const SUGGESTIONS_ASK = [
  'Summarize this month’s invoices',
  'How many students have outstanding dues?',
  'Show the finance ledger totals',
];
const SUGGESTIONS_AGENT = [
  'Create a new student named Ayesha, roll 12, class Play',
  'Record a 500 fee payment for the student with most dues',
  'Add a 10,000 loan given to Mr. Rahman',
];
