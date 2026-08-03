"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AiAssistant, type Suggestion } from "@/components/dashboard/ai-assistant";
import { useApi, type ChatSession, type ChatTurn } from "@/lib/api";
import { formatTime } from "@/lib/underwriting";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

/**
 * AiAssistant plus the conversation list that feeds it. `assessmentId` scopes both ends: the
 * sidebar lists only that assessment's chats and new sessions are filed under it, so the
 * portfolio page and each workspace keep separate histories.
 */
export function ChatPane({
  assessmentId,
  header,
  compact,
  ...chat
}: {
  assessmentId?: string;
  header?: ReactNode;
  /** Shorter conversation list, for the workspace where the chat is one section among many. */
  compact?: boolean;
  greeting: string;
  context: string;
  suggestions: Suggestion[];
  caseId?: number;
}) {
  const api = useApi();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Remounting AiAssistant is what resets it when the reader switches conversation. activeId can't
  // drive the key: the live chat sets it too, the moment the API hands back a new session id.
  const [chatKey, setChatKey] = useState(0);

  const refresh = useCallback(() => {
    api.listSessions(assessmentId).then(setSessions).catch((e: Error) => setError(e.message));
  }, [api, assessmentId]);

  useEffect(refresh, [refresh]);

  function startChat(id: string | null, turns: ChatTurn[]) {
    setActiveId(id);
    setHistory(turns);
    setChatKey((k) => k + 1);
  }

  async function openSession(id: string) {
    try {
      startChat(id, await api.getSession(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open that conversation.");
    }
  }

  async function deleteSession(session: ChatSession) {
    if (!confirm(`Delete "${session.title ?? "this conversation"}"? This cannot be undone.`)) return;
    try {
      await api.del(`/api/sessions/${session.session_id}`);
      if (session.session_id === activeId) startChat(null, []);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete that conversation.");
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <aside
          className={cn(
            "shrink-0 bg-card/40 border border-border/60 p-3 flex flex-col",
            compact ? "lg:w-56" : "lg:w-64"
          )}
        >
          <button
            onClick={() => startChat(null, [])}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-secondary text-sm font-medium text-foreground hover:bg-secondary/70 transition-colors duration-200"
          >
            <Plus className="w-3.5 h-3.5" />
            New chat
          </button>

          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mt-4 mb-2 px-1">
            Conversations
          </p>

          <div className={cn("space-y-1 overflow-y-auto", compact ? "max-h-[220px]" : "max-h-[300px] lg:max-h-[420px]")}>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1 py-2">Nothing here yet.</p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.session_id}
                  className={cn(
                    "group flex items-center gap-1",
                    session.session_id === activeId ? "bg-secondary" : "hover:bg-secondary/50"
                  )}
                >
                  <button
                    onClick={() => openSession(session.session_id)}
                    aria-current={session.session_id === activeId}
                    className="min-w-0 flex-1 text-left px-2 py-2"
                  >
                    <p className="text-sm text-foreground truncate">{session.title ?? "Untitled"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {formatTime(session.last_at)} • {session.message_count} messages
                    </p>
                  </button>
                  <button
                    onClick={() => deleteSession(session)}
                    aria-label={`Delete conversation ${session.title ?? session.session_id}`}
                    className="shrink-0 p-2 text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-destructive transition-all duration-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {header}
          <AiAssistant
            key={chatKey}
            assessmentId={assessmentId}
            sessionId={activeId}
            history={history}
            onSessionSaved={(id) => {
              setActiveId(id);
              refresh();
            }}
            {...chat}
          />
        </div>
      </div>
    </div>
  );
}
