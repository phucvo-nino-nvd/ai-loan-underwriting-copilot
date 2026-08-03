"use client";

import { useAuth } from "@clerk/react";
import { useMemo } from "react";
import { getApiUrl } from "@/lib/config";
import type { AssessmentRecord, Applicant } from "@/lib/underwriting";

const BASE = getApiUrl();

/**
 * CloudFront OAC signs origin requests with SigV4, but it does not hash the body itself:
 * Lambda function URLs reject unsigned payloads, so the viewer has to supply the hash.
 * https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda.html
 */
export async function payloadHash(body: string | ArrayBuffer): Promise<string> {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface Feature {
  feature: string;
  value: number | string | null;
  shap_value: number;
  importance: number;
}

export type StreamEvent =
  | { type: "session"; sessionId: string }
  | { type: "chunk"; chunk: string }
  | { type: "tool_call"; name: string }
  | { type: "tool_result"; name: string }
  | { type: "sources"; sources: string[] };

/**
 * assessments.top_features is a free-form JSONB column, so an older or seeded row can be missing
 * the keys the workspace reads. Fill them in rather than let one bad row take the page down.
 */
const normalizeFeature = (f: Partial<Feature>): Feature => ({
  feature: f.feature ?? "unknown",
  value: f.value ?? null,
  shap_value: f.shap_value ?? 0,
  importance: f.importance ?? 0,
});

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  /** Retrieved chunks behind the citation badges. Null on user turns and pre-existing messages. */
  sources?: string[] | null;
}

export interface ChatSession {
  session_id: string;
  title: string | null;
  message_count: number;
  last_message: string | null;
  last_at: string;
}

export interface Prediction {
  case_id: number;
  probability: number;
  risk_band: "LOW" | "MEDIUM" | "HIGH" | "VERY HIGH";
  top_features: Feature[];
}

export function useApi() {
  const { getToken } = useAuth();

  return useMemo(() => {
    async function signed(path: string, init: RequestInit, hashed: string | ArrayBuffer) {
      const res = await fetch(BASE + path, {
        ...init,
        headers: {
          ...init.headers,
          // Not Authorization: CloudFront overwrites that header when it signs the origin request.
          "X-Clerk-Token": `Bearer ${await getToken()}`,
          "x-amz-content-sha256": await payloadHash(hashed),
        },
      });
      if (!res.ok) {
        const detail = await res.json().then((b) => b?.detail).catch(() => null);
        throw new Error(detail ?? `${path} → ${res.status} ${res.statusText}`);
      }
      return res;
    }

    async function request(path: string, body?: unknown, method?: string) {
      const payload = body === undefined ? "" : JSON.stringify(body);
      return signed(
        path,
        {
          method: method || (body === undefined ? "GET" : "POST"),
          headers: { "Content-Type": "application/json" },
          body: body === undefined ? undefined : payload,
        },
        payload,
      );
    }

    return {
      async del(path: string): Promise<void> {
        await request(path, undefined, "DELETE");
      },

      /** No assessment id means the portfolio conversations — the API keeps the two sets disjoint. */
      async listSessions(assessmentId?: string): Promise<ChatSession[]> {
        const query = assessmentId ? `?assessment_id=${encodeURIComponent(assessmentId)}` : "";
        return (await (await request(`/api/sessions${query}`)).json()).sessions;
      },

      async getSession(sessionId: string): Promise<ChatTurn[]> {
        return (await (await request(`/api/sessions/${sessionId}`)).json()).messages;
      },

      async getPolicyDocuments(): Promise<{ id: string; title: string; category?: string }[]> {
        return (await (await request("/api/rag/documents")).json()).documents;
      },

      /**
       * FormData is not usable here: the browser picks the multipart boundary after the request is
       * built, so the body could not be hashed for x-amz-content-sha256. Assemble it by hand.
       */
      async uploadPolicy(file: File): Promise<void> {
        const boundary = `----aluci${crypto.randomUUID()}`;
        const filename = file.name.replace(/["\r\n]/g, "");
        const body = await new Blob([
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n`,
          `Content-Type: application/octet-stream\r\n\r\n`,
          file,
          `\r\n--${boundary}--\r\n`,
        ]).arrayBuffer();

        await signed(
          "/api/rag/upload",
          { method: "POST", body, headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` } },
          body,
        );
      },

      async predict(caseId: number, topK = 10): Promise<Prediction> {
        return (await request("/api/predict", { case_id: caseId, top_k: topK })).json();
      },

      async getHistory(): Promise<AssessmentRecord[]> {
        const { assessments } = await (await request("/api/assessments")).json();
        return (assessments as AssessmentRecord[]).map((a) => ({
          ...a,
          top_features: (a.top_features ?? []).map(normalizeFeature),
        }));
      },

      async getApplications(): Promise<Applicant[]> {
        return (await (await request("/api/applications")).json()).applications;
      },

      async saveHistory(payload: unknown): Promise<{ id: string; applicationId: string; applicantId: string }> {
        return (await request("/api/assessments", payload)).json();
      },

      async saveDecision(payload: { assessment_id: string; decision: string }): Promise<void> {
        await request("/api/decisions", payload);
      },

      /** SSE over POST — EventSource can't send auth headers, so read the stream by hand. */
      async *stream(path: "/api/report" | "/api/policy", body: any): AsyncGenerator<StreamEvent> {
        const res = await request(path, body);
        const sessionId = res.headers.get("X-Session-Id");
        if (sessionId) yield { type: "session", sessionId };

        const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += value;
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? ""; // keep the trailing partial event
          for (const e of events) {
            if (e.startsWith("data: ")) {
              const parsed = JSON.parse(e.slice(6));
              if (typeof parsed === "string") {
                yield { type: "chunk", chunk: parsed };
              } else if (parsed && typeof parsed === "object") {
                if (parsed.type === "content") {
                  yield { type: "chunk", chunk: parsed.content };
                } else if (parsed.type === "tool_call") {
                  yield { type: "tool_call", name: parsed.name };
                } else if (parsed.type === "tool_result") {
                  yield { type: "tool_result", name: parsed.name };
                } else if (parsed.type === "sources") {
                  yield { type: "sources", sources: parsed.sources };
                }
              }
            }
          }
        }
      },
    };
  }, [getToken]);
}

export const bandStyle: Record<Prediction["risk_band"], { color: string; bg: string }> = {
  LOW: { color: "text-success", bg: "bg-success/10" },
  MEDIUM: { color: "text-warning", bg: "bg-warning/10" },
  HIGH: { color: "text-destructive", bg: "bg-destructive/10" },
  "VERY HIGH": { color: "text-destructive", bg: "bg-destructive/20" },
};
