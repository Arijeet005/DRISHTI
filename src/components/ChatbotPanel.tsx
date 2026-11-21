import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, MessageCircle, Send, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface ChatbotPanelProps {
  onClose: () => void;
}

export const ChatbotPanel: React.FC<ChatbotPanelProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: 'Hello! I am the DRISHTI assistant. Ask me about using the app or land-acquisition risk concepts.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;

    const conversation = [...messages, { role: 'user' as const, text }];
    setMessages(conversation);
    setInput('');
    setError('');
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversation.slice(-20) }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'The assistant could not respond.');
      }
      setMessages((current) => [...current, { role: 'model', text: data.reply }]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'The assistant could not respond.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#4F5B2A]/30"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="chatbot-title"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l-4 border-[#4F5B2A] bg-[#F5EFE3] shadow-[-8px_0_0_0_#4F5B2A33]"
      >
        <header className="flex items-center justify-between border-b-2 border-[#4F5B2A] bg-[#D8C9A8] p-4">
          <div className="flex items-center gap-3">
            <div className="border-2 border-[#4F5B2A] bg-[#B8892D] p-2 text-[#F5EFE3]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 id="chatbot-title" className="text-sm font-black uppercase tracking-wide">
                DRISHTI AI Assistant
              </h2>
              <p className="text-xs font-medium">Powered by Gemini</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI assistant"
            className="border-2 border-[#4F5B2A] p-1.5 hover:bg-[#F5EFE3]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-[88%] break-words border-2 border-[#4F5B2A] p-3 text-sm leading-relaxed ${
                message.role === 'user'
                  ? 'ml-auto bg-[#4F5B2A] text-[#F5EFE3]'
                  : 'bg-white text-[#4F5B2A] shadow-[2px_2px_0px_0px_#4F5B2A]'
              }`}
            >
              {message.role === 'model' ? (
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h3 className="mb-2 mt-4 text-base font-bold first:mt-0">{children}</h3>,
                    h2: ({ children }) => <h3 className="mb-2 mt-4 text-base font-bold first:mt-0">{children}</h3>,
                    h3: ({ children }) => <h3 className="mb-2 mt-3 font-bold first:mt-0">{children}</h3>,
                    h4: ({ children }) => <h4 className="mb-2 mt-3 font-bold first:mt-0">{children}</h4>,
                    h5: ({ children }) => <h4 className="mb-2 mt-3 font-bold first:mt-0">{children}</h4>,
                    h6: ({ children }) => <h4 className="mb-2 mt-3 font-bold first:mt-0">{children}</h4>,
                    p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
                    li: ({ children }) => <li className="pl-1">{children}</li>,
                    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    blockquote: ({ children }) => (
                      <blockquote className="mb-3 border-l-2 border-[#B8892D] pl-3 italic">{children}</blockquote>
                    ),
                    a: ({ children, href }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#4F5B2A] underline underline-offset-2"
                      >
                        {children}
                      </a>
                    ),
                    code: ({ children }) => (
                      <code className="rounded bg-[#F5EFE3] px-1 py-0.5 font-mono text-[0.9em]">{children}</code>
                    ),
                    pre: ({ children }) => (
                      <pre className="mb-3 overflow-x-auto rounded bg-[#F5EFE3] p-2 font-mono text-xs last:mb-0">
                        {children}
                      </pre>
                    ),
                  }}
                >
                  {message.text}
                </ReactMarkdown>
              ) : (
                message.text
              )}
            </div>
          ))}
          {isSending && (
            <div className="flex items-center gap-2 text-xs font-bold uppercase">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={sendMessage} className="border-t-2 border-[#4F5B2A] bg-[#D8C9A8] p-3">
          {error && (
            <p role="alert" className="mb-2 border border-[#A8442E] bg-[#F5EFE3] p-2 text-xs font-semibold text-[#A8442E]">
              {error}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              maxLength={4000}
              rows={2}
              placeholder="Ask a question..."
              aria-label="Message the DRISHTI AI assistant"
              className="min-h-12 flex-1 resize-none border-2 border-[#4F5B2A] bg-white px-3 py-2 text-sm text-[#4F5B2A] outline-none focus:ring-2 focus:ring-[#B8892D]"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              aria-label="Send message"
              className="flex h-12 items-center justify-center gap-2 border-2 border-[#4F5B2A] bg-[#4F5B2A] px-3 font-bold text-[#F5EFE3] hover:bg-[#3f4922] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
          <p className="mt-2 flex items-center gap-1 text-[10px] font-medium">
            <MessageCircle className="h-3 w-3" />
            Please verify important legal or project-specific information.
          </p>
        </form>
      </section>
    </div>
  );
};
