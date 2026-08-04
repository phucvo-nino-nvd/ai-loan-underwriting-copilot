"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useApi, type ChatTurn } from "@/lib/api";
import { defaultSettings, loadSettings, patchSettings } from "@/lib/settings";
import { Send, Sparkles } from "lucide-react";
import { MarkdownText } from "@/components/ui/markdown-text";
import { BitmapChevron } from "@/components/landing/bitmap-chevron";

function toolLabel(name: string) {
  if (name.includes("browser") || name.includes("playwright")) return "MCP browser";
  if (name.includes("retrieve_policy") || name.includes("search_policy")) return "policy search";
  return name;
}

function TerminalSpinner() {
  const [frame, setFrame] = useState(0);
  const frames = ["|", "/", "-", "\\"];

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return <span className="font-mono text-accent w-3 inline-block text-center shrink-0">{frames[frame]}</span>;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  activeTools?: string[];
  sources?: string[];
}

/** A plain string asks the chat route; the object form runs a Copilot report instead. */
export type Suggestion = string | { label: string; kind: "report" | "recommend" };

/**
 * Chat surface, scoped by whatever context the caller passes — an assessment in the workspace,
 * the portfolio on the AI Assistant page. `caseId` unlocks the report suggestions, `assessmentId`
 * files new sessions under that assessment so its sidebar can find them again.
 *
 * `sessionId`/`history` resume an earlier conversation. They are read once at mount, so a caller
 * switching conversations must remount this component with a new `key`.
 */
export function AiAssistant({
  greeting,
  context,
  suggestions,
  caseId,
  assessmentId,
  sessionId,
  history,
  onSessionSaved,
}: {
  greeting: string;
  context: string;
  suggestions: Suggestion[];
  caseId?: number;
  assessmentId?: string;
  sessionId?: string | null;
  history?: ChatTurn[];
  onSessionSaved?: (sessionId: string) => void;
}) {
  const api = useApi();
  // id 0 is reserved for the greeting, which is what the empty state keys off.
  const [messages, setMessages] = useState<Message[]>(() =>
    history?.length
      ? history.map((turn, i) => ({ id: i + 1, role: turn.role, text: turn.content, sources: turn.sources ?? undefined }))
      : [{ id: 0, role: "assistant", text: greeting }],
  );
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<string | null>(sessionId ?? null);
  const idCounter = useRef((history?.length ?? 0) + 1);

  // localStorage is only readable after mount, so start from the defaults and settle on the first effect.
  const [aiConfig, setAiConfig] = useState(defaultSettings().aiConfig);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const stored = loadSettings();
    setAiConfig(stored.aiConfig);
    setUserName(stored.profile.firstName);
  }, []);

  function updateModel(preferredModel: string) {
    setAiConfig((c) => ({ ...c, preferredModel }));
    patchSettings({ aiConfig: { preferredModel } });
  }

  const prevMessagesLength = useRef(messages.length);
  const isAtBottomRef = useRef(true);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  useEffect(() => {
    if (!scrollRef.current) return;

    const isNewMessage = messages.length > prevMessagesLength.current;
    prevMessagesLength.current = messages.length;

    if (isAtBottomRef.current || isNewMessage) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: isNewMessage ? "smooth" : "auto",
      });
    }
  }, [messages, isTyping]);

  async function send(text: string, kind?: "report" | "recommend") {
    const question = text.trim();
    if (!question || isTyping) return;

    const userId = idCounter.current++;
    const replyId = idCounter.current++;
    setMessages((prev) => [...prev, { id: userId, role: "user", text: question }]);
    setInput("");
    setIsTyping(true);

    try {
      // /api/report re-reads the features and re-scores from Aurora, so it only needs the case id.
      const stream =
        kind && caseId !== undefined
          ? api.stream("/api/report", {
              case_id: caseId,
              kind,
              session_id: sessionRef.current,
              assessment_id: assessmentId,
              ai_config: aiConfig,
            })
          : api.stream("/api/policy", {
              message: question,
              // Send this every turn. The API puts it in the system prompt, not in chat_messages,
              // so it is not part of the stored history and vanishes from the model's view otherwise.
              context,
              session_id: sessionRef.current,
              assessment_id: assessmentId,
              ai_config: aiConfig,
            });

      for await (const event of stream) {
        if (event.type === "session") {
          sessionRef.current = event.sessionId;
          continue;
        }
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.id === replyId) {
            if (event.type === "chunk") {
              return [...prev.slice(0, -1), { ...last, text: last.text + event.chunk }];
            } else if (event.type === "sources") {
              return [
                ...prev.slice(0, -1),
                { ...last, sources: event.sources },
              ];
            } else if (event.type === "tool_call") {
              return [...prev.slice(0, -1), { ...last, activeTools: [...(last.activeTools || []), event.name] }];
            } else if (event.type === "tool_result") {
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  activeTools: (() => {
                    const arr = [...(last.activeTools || [])];
                    const idx = arr.indexOf(event.name);
                    if (idx !== -1) arr.splice(idx, 1);
                    return arr;
                  })(),
                },
              ];
            }
          } else {
            if (event.type === "chunk") {
              return [...prev, { id: replyId, role: "assistant", text: event.chunk }];
            } else if (event.type === "tool_call") {
              return [...prev, { id: replyId, role: "assistant", text: "", activeTools: [event.name] }];
            }
          }
          return prev;
        });
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Failed to get response from AI. Please try again.";
      setMessages((prev) => [...prev, { id: replyId, role: "assistant", text: `Error: ${errMsg}` }]);
    } finally {
      setIsTyping(false);
      // The API persists the reply before it closes the stream, so the list is fresh by now.
      if (sessionRef.current) onSessionSaved?.(sessionRef.current);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Assistant conversation"
        data-citation-boundary
        className="h-72 sm:h-80 overflow-y-auto pr-1 space-y-4"
      >
        {messages.length === 1 && messages[0].id === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 animate-in fade-in duration-700">
            <div className="w-20 h-20 mb-6 bg-secondary/80 border border-border/50 rounded-lg flex items-center justify-center shadow-sm">
              <BitmapChevron className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-foreground mb-2">
              Hi{userName ? ` ${userName}` : ""}. I'm Aluci.
            </h3>
            <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
              Drop a loan application here and let's analyze it, or ask me anything about the portfolio.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
                message.role === "user" && "justify-end",
                !message.text && (!message.activeTools || message.activeTools.length === 0) && !isTyping && "hidden"
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
                  <>
                    {message.text && <MarkdownText text={message.text} sources={message.sources} />}
                    {message.activeTools && message.activeTools.length > 0 && (
                      <div className={cn("flex flex-col gap-1.5", message.text && "mt-2")}>
                        {message.activeTools.map((tool, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <TerminalSpinner />
                            <span>Running {toolLabel(tool)}...</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {!message.text && (!message.activeTools || message.activeTools.length === 0) && isTyping && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <TerminalSpinner />
                        <span>Working...</span>
                      </div>
                    )}
                  </>
                ) : (
                  message.text
                )}
              </div>
            </div>
          ))
        )}

        {isTyping && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3 animate-in fade-in duration-200">
            <div className="w-8 h-8 bg-accent/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <div className="flex items-center gap-2 px-4 py-3 bg-secondary/50 border border-border text-sm text-muted-foreground">
              <TerminalSpinner />
              <span>Working...</span>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      {/* pb keeps the input's border off the panel's own bottom border, which stretches to this height. */}
      <div className="space-y-3 pt-4 pb-4">
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => {
            const label = typeof suggestion === "string" ? suggestion : suggestion.label;
            const kind = typeof suggestion === "string" ? undefined : suggestion.kind;
            return (
              <button
                key={label}
                onClick={() => send(label, kind)}
                disabled={isTyping}
                className="px-3 py-1.5 bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors duration-200"
              >
                {label}
              </button>
            );
          })}
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
            placeholder="Ask Aluci about this loan..."
            aria-label="Ask Aluci about this loan"
            className="flex-1 h-9 px-4 bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
          />
          <div className="relative">
            <select
              value={aiConfig.preferredModel}
              onChange={(e) => updateModel(e.target.value)}
              aria-label="Model"
              className="h-9 appearance-none bg-secondary border border-border text-foreground text-xs font-medium pl-3 pr-7 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200 cursor-pointer hover:border-accent/50"
            >
              <option value="openai/gpt-oss-120b">GPT-OSS 120B</option>
              <option value="openai/gpt-oss-20b">GPT-OSS 20B</option>
              <option value="deepseek/deepseek-v4-flash">DeepSeek V4 Flash</option>
            </select>
            <svg
              className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
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
