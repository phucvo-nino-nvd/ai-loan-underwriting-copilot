"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/api";
import { Send, Sparkles, Key } from "lucide-react";
import { MarkdownText } from "@/components/ui/markdown-text";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
}

/**
 * Chat surface, scoped by whatever context the caller passes — an assessment in the workspace,
 * the portfolio on the AI Assistant page. Falls back to `mockReply` when the backend is absent.
 */
export function AiAssistant({
  greeting,
  context,
  suggestions,
  mockReply,
}: {
  greeting: string;
  context: string;
  suggestions: string[];
  mockReply: (question: string) => string;
}) {
  const api = useApi();
  const [messages, setMessages] = useState<Message[]>([{ id: 0, role: "assistant", text: greeting }]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<string | null>(null);
  const idCounter = useRef(1);

  const [hasKey, setHasKey] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("swin_settings");
      if (raw) {
        const data = JSON.parse(raw);
        if (!data?.aiConfig?.geminiKey && !data?.aiConfig?.nvidiaKey) {
          setHasKey(false);
        }
      } else {
        setHasKey(false);
      }
    } catch {
      setHasKey(false);
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  if (!hasKey) {
    return (
      <div className="flex flex-col items-center justify-center h-72 sm:h-80 text-center bg-secondary/20 border border-border/50 p-6 animate-in fade-in">
        <Key className="w-10 h-10 mb-4 text-muted-foreground" />
        <h3 className="text-base font-semibold text-foreground tracking-tight">API Key Required</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed">
          Please configure an AI Provider (Gemini or NVIDIA) to use the Assistant. 
          Your keys are stored securely in your browser.
        </p>
        <p className="text-xs font-bold font-mono uppercase tracking-widest text-accent mt-6">
          Go to Settings &rarr; AI Config
        </p>
      </div>
    );
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || isTyping) return;

    const userId = idCounter.current++;
    const replyId = idCounter.current++;
    setMessages((prev) => [...prev, { id: userId, role: "user", text: question }]);
    setInput("");
    setIsTyping(true);

    try {
      const message = sessionRef.current ? question : context + question;
      for await (const event of api.stream("/policy", { message, session_id: sessionRef.current })) {
        if (event.type === "session") {
          sessionRef.current = event.sessionId;
          continue;
        }
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.id === replyId) {
            return [...prev.slice(0, -1), { ...last, text: last.text + event.chunk }];
          }
          return [...prev, { id: replyId, role: "assistant", text: event.chunk }];
        });
      }
    } catch {
      await new Promise((r) => setTimeout(r, 600));
      setMessages((prev) => [...prev, { id: replyId, role: "assistant", text: mockReply(question) }]);
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Messages */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Assistant conversation"
        className="h-72 sm:h-80 overflow-y-auto overscroll-contain pr-1 space-y-4"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
              message.role === "user" && "justify-end"
            )}
          >
            {message.role === "assistant" && (
              <div className="w-8 h-8 bg-accent/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-accent" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[85%] sm:max-w-[80%] px-4 py-3 text-sm leading-relaxed border",
                message.role === "assistant"
                  ? "bg-secondary/50 border-border text-foreground rounded-tl-sm"
                  : "bg-accent border-transparent text-accent-foreground rounded-tr-sm"
              )}
            >
              {message.role === "assistant" ? (
                <MarkdownText text={message.text} />
              ) : (
                message.text
              )}
            </div>
          </div>
        ))}

        {isTyping && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3 animate-in fade-in duration-200">
            <div className="w-8 h-8 bg-accent/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <div className="flex items-center gap-1 px-4 py-3 bg-secondary/50 border border-border">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
              <span className="sr-only">Assistant is typing</span>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="space-y-3 pt-4">
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => send(suggestion)}
              disabled={isTyping}
              className="px-3 py-1.5 bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors duration-200"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a follow-up question..."
            aria-label="Ask a follow-up question"
            className="flex-1 h-9 px-4 bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            aria-label="Send message"
            className="w-9 h-9 flex items-center justify-center bg-accent text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity duration-200"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
