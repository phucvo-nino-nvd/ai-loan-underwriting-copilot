"use client";

import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Feature {
  feature: string;
  value: number | string | null;
  shap_value: number;
  importance: number;
}

export type StreamEvent =
  | { type: "session"; sessionId: string }
  | { type: "chunk"; chunk: string };

export interface Prediction {
  case_id: number;
  probability: number;
  risk_band: "LOW" | "MEDIUM" | "HIGH" | "VERY HIGH";
  top_features: Feature[];
}

export function useApi() {
  const { getToken } = useAuth();

  return useMemo(() => {
    async function request(path: string, body?: unknown) {
      const res = await fetch(BASE + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getToken()}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${path} → ${res.status} ${res.statusText}`);
      return res;
    }

    return {
      async listCases(): Promise<number[]> {
        return (await (await request("/cases")).json()).case_ids;
      },

      async predict(caseId: number, topK = 10): Promise<Prediction> {
        return (await request("/predict", { case_id: caseId, top_k: topK })).json();
      },

      /** SSE over POST — EventSource can't send an Authorization header, so read the stream by hand. */
      async *stream(path: "/report" | "/policy", body: any): AsyncGenerator<StreamEvent> {
        let aiConfig = undefined;
        try {
          const raw = localStorage.getItem("swin_settings");
          if (raw) aiConfig = JSON.parse(raw).aiConfig;
        } catch {}

        const payload = typeof body === "object" && body !== null ? { ...body, ai_config: aiConfig } : body;
        const res = await request(path, payload);
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
            if (e.startsWith("data: ")) yield { type: "chunk", chunk: JSON.parse(e.slice(6)) as string };
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
