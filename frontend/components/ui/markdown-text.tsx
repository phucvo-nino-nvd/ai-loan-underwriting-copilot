"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function MarkdownText({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/);

  return (
    <div className={cn("space-y-2", className)}>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith("```")) {
          const code = trimmed.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
          return (
            <pre
              key={i}
              className="px-3 py-2 bg-black/20 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words"
            >
              {code}
            </pre>
          );
        }

        const headingMatch = trimmed.match(/^(#{1,6})\s+/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const content = trimmed.slice(headingMatch[0].length);
          const sizes: Record<number, string> = {
            1: "text-base font-bold",
            2: "text-sm font-bold",
            3: "text-sm font-semibold",
            4: "text-xs font-semibold",
            5: "text-xs font-medium",
            6: "text-xs font-medium",
          };
          const Tag = `h${level}` as React.ElementType;
          return (
            <Tag key={i} className={cn("text-foreground", sizes[level] ?? sizes[6])}>
              {renderInline(content)}
            </Tag>
          );
        }

        if (/^[-*]\s/.test(trimmed)) {
          return (
            <ul key={i} className="list-disc pl-4 space-y-1">
              {trimmed.split("\n").map((line, li) => {
                const item = line.replace(/^[-*]\s+/, "");
                return (
                  <li key={li} className="text-sm leading-relaxed">
                    {renderInline(item)}
                  </li>
                );
              })}
            </ul>
          );
        }

        return (
          <p key={i} className="whitespace-pre-wrap">
            {renderInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string): (string | React.ReactElement)[] {
  const parts: (string | React.ReactElement)[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${match.index}`;

    if (token.startsWith("`")) {
      parts.push(
        <code key={key} className="px-1.5 py-0.5 rounded bg-black/20 text-xs font-mono">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
