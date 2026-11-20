import React, { useEffect, useRef, useState } from 'react';
import { Project } from '../types/project';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  AlertCircle,
  MessageSquare,
  RotateCcw,
  Send,
  Trash2,
  X,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  timestamp: string;
}

interface DrishtiAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  contextProject: Project | null;
  onClearContextProject: () => void;
  initialPrompt?: string | null;
  onConsumeInitialPrompt?: () => void;
}

const TOOL_LABELS: Record<string, string> = {
  get_portfolio_summary: 'Portfolio Summary',
  list_projects: 'Project Registry',
  get_project_details: 'Project Record',
  predict_project_risk: 'ML Risk Predictor',
};

const QUICK_STARTERS = [
  'Summarize portfolio bottlenecks and the top high-risk projects.',
  'Which projects have active Sec. 3G(5) arbitration, and does it block possession?',
  'Explain the 7-stage NH Act & RFCTLARR land acquisition workflow.',
  'Simulate risk for a 120 Ha project in Indore if compensation is Paid and litigation is cleared.',
];

function renderInlineFormatting(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={idx} className="font-bold">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 bg-[#D8C9A8]/60 border border-[#4F5B2A]/30 font-mono text-[11px]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

const FormattedMessage: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  const flushList = (keyPrefix: string) => {
    if (listItems.length === 0) return;
    if (listOrdered) {
      blocks.push(
        <ol key={`${keyPrefix}-ol`} className="list-decimal pl-5 space-y-1 my-1.5">
          {listItems.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ol>
      );
    } else {
      blocks.push(
        <ul key={`${keyPrefix}-ul`} className="list-disc pl-5 space-y-1 my-1.5">
          {listItems.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ul>
      );
    }
    listItems = [];
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushList(`line-${idx}`);
      return;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);

    if (bulletMatch) {
      if (listItems.length > 0 && listOrdered) flushList(`switch-${idx}`);
      listOrdered = false;
      listItems.push(bulletMatch[1]);
      return;
    }

    if (orderedMatch) {
      if (listItems.length > 0 && !listOrdered) flushList(`switch-${idx}`);
      listOrdered = true;
      listItems.push(orderedMatch[1]);
      return;
    }

    flushList(`pre-${idx}`);

    const headingMatch = line.match(/^#{1,4}\s+(.*)$/);
    if (headingMatch) {
      blocks.push(
        <div key={`h-${idx}`} className="font-black text-xs uppercase tracking-wider mt-2.5 mb-1">
          {renderInlineFormatting(headingMatch[1])}
        </div>
      );
      return;
    }

    blocks.push(
      <p key={`p-${idx}`} className="leading-relaxed my-1">
        {renderInlineFormatting(line)}
      </p>
    );
  });

  flushList('end');
  return <div className="text-[13px] space-y-1 tabular-nums">{blocks}</div>;
};

export const DrishtiAssistant: React.FC<DrishtiAssistantProps> = ({
  isOpen,
  onClose,
  contextProject,
  onClearContextProject,
  initialPrompt,
  onConsumeInitialPrompt,
}) => {
  const { role } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, errorMsg]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!textOverride) {
      setInput('');
    }
    setErrorMsg(null);
    setLastFailedInput(null);
    setIsLoading(true);

    try {
      const response = await api.chat({
        messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        activeProjectId: contextProject?._id || null,
      });

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        toolsUsed: response.toolsUsed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to reach DRISHTI AI Assistant.');
      setLastFailedInput(text);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && initialPrompt) {
      const promptToSend = initialPrompt;
      onConsumeInitialPrompt?.();
      sendMessage(promptToSend);
    }
  }, [isOpen, initialPrompt]);

  if (!isOpen) return null;

  const handleRetry = () => {
    if (!lastFailedInput || isLoading) return;
    const retryText = lastFailedInput;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'user' && last.content === retryText) {
        return prev.slice(0, -1);
      }
      return prev;
    });
    sendMessage(retryText);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#4F5B2A]/45"
      role="dialog"
      aria-modal="true"
      aria-label="DRISHTI AI Assistant"
    >
      <div className="flex-1" onClick={onClose} aria-hidden="true" />

      <aside className="w-full max-w-lg bg-[#F5EFE3] border-l-2 border-[#4F5B2A] shadow-[-6px_0px_0px_0px_#4F5B2A] flex flex-col h-full">
        {/* Top Bar */}
        <div className="bg-[#4F5B2A] text-[#F5EFE3] px-4 py-3 border-b-2 border-[#4F5B2A] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#B8892D] shrink-0" />
              <h2 className="text-base font-black uppercase tracking-tight truncate">
                DRISHTI Assistant
              </h2>
            </div>
            <div className="text-[11px] text-[#F5EFE3]/80 font-medium mt-0.5">
              Statutory & Risk Intelligence · Role: {role}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  setErrorMsg(null);
                  setLastFailedInput(null);
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#F5EFE3] text-[#4F5B2A] border border-[#4F5B2A] text-xs font-bold uppercase whitespace-nowrap shrink-0 hover:bg-[#D8C9A8] transition-colors"
                title="Clear conversation"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-[#F5EFE3] text-[#4F5B2A] border border-[#4F5B2A] hover:bg-[#D8C9A8] transition-colors shrink-0"
              aria-label="Close assistant"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Active Project Context Line */}
        {contextProject && (
          <div className="bg-[#D8C9A8] border-b border-[#4F5B2A] px-4 py-2 flex items-center justify-between gap-2 text-xs text-[#4F5B2A]">
            <div className="min-w-0 truncate">
              <span className="font-bold">Active Context:</span>{' '}
              <span className="font-black">{contextProject.name}</span>
              <span className="text-[#4F5B2A]/80">
                {' '}· {contextProject.district}, {contextProject.state} · Risk {contextProject.riskScore}/100
              </span>
            </div>
            <button
              type="button"
              onClick={onClearContextProject}
              className="text-[11px] font-bold underline hover:text-[#A8442E] whitespace-nowrap shrink-0"
            >
              Clear
            </button>
          </div>
        )}

        {/* Messages Viewport */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="space-y-4 py-2">
              <div className="p-3.5 bg-[#D8C9A8]/45 border border-[#4F5B2A] text-[#4F5B2A] space-y-1.5">
                <div className="text-xs font-black uppercase tracking-wider">
                  Land Acquisition & Risk Advisor
                </div>
                <p className="text-xs leading-relaxed text-[#4F5B2A]/90">
                  Ask about live portfolio bottlenecks, statutory deadlines under the National Highways Act, 1956 and RFCTLARR Act, 2013, or run what-if delay risk simulations.
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#4F5B2A]/75">
                  Suggested Prompts
                </div>
                <div className="space-y-1.5">
                  {QUICK_STARTERS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="w-full text-left px-3 py-2 bg-[#F5EFE3] border border-[#4F5B2A] text-xs font-semibold text-[#4F5B2A] hover:bg-[#D8C9A8] shadow-[2px_2px_0px_0px_#4F5B2A] transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[90%] p-3 border border-[#4F5B2A] ${
                    msg.role === 'user'
                      ? 'bg-[#4F5B2A] text-[#F5EFE3] shadow-[2px_2px_0px_0px_#B8892D]'
                      : 'bg-[#D8C9A8]/40 text-[#4F5B2A] shadow-[2px_2px_0px_0px_#4F5B2A]'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <div className="text-[13px] font-medium leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  ) : (
                    <FormattedMessage content={msg.content} />
                  )}

                  <div
                    className={`mt-1.5 pt-1 border-t text-[10px] flex items-center justify-between gap-2 ${
                      msg.role === 'user'
                        ? 'border-[#F5EFE3]/20 text-[#F5EFE3]/75'
                        : 'border-[#4F5B2A]/20 text-[#4F5B2A]/70'
                    }`}
                  >
                    <span>
                      {msg.role === 'user' ? 'You' : 'DRISHTI AI'} · {msg.timestamp}
                    </span>
                    {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                      <span className="truncate">
                        Checked:{' '}
                        {msg.toolsUsed.map((t) => TOOL_LABELS[t] || t).join(' · ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex items-start">
              <div className="px-3 py-2 bg-[#D8C9A8]/50 border border-[#4F5B2A] text-xs font-bold text-[#4F5B2A]">
                Analyzing portfolio & statutory context...
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-[#A8442E]/10 border border-[#A8442E] text-[#A8442E] text-xs space-y-2">
              <div className="flex items-start gap-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              {lastFailedInput && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#A8442E] text-[#F5EFE3] border border-[#4F5B2A] text-[11px] font-bold uppercase whitespace-nowrap shrink-0 hover:brightness-110"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Input Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="p-3 bg-[#D8C9A8]/60 border-t-2 border-[#4F5B2A] flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask about project risks, Sec. 3G(5) arbitration, or simulate a scenario..."
            className="flex-1 px-2.5 py-2 bg-[#F5EFE3] border-2 border-[#4F5B2A] text-xs font-medium text-[#4F5B2A] placeholder-[#4F5B2A]/60 focus:outline-none focus:ring-2 focus:ring-[#B8892D] resize-none"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-[#4F5B2A] text-[#F5EFE3] border-2 border-[#4F5B2A] font-bold uppercase text-xs shadow-[2px_2px_0px_0px_#B8892D] hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </aside>
    </div>
  );
};
