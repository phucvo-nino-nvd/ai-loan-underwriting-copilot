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

        if (/^\d+[.)]\s/.test(trimmed)) {
          return (
            <ol key={i} className="list-decimal pl-4 space-y-1">
              {trimmed.split("\n").map((line, li) => {
                const item = line.replace(/^\s*\d+[.)]\s+/, "");
                return (
                  <li key={li} className="text-sm leading-relaxed">
                    {renderInline(item)}
                  </li>
                );
              })}
            </ol>
          );
        }

        if (/^-{3,}$/.test(trimmed) || /^_{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
          return <hr key={i} className="my-3 border-border" />;
        }

        if (trimmed.includes("|") && trimmed.split("\n").length >= 2) {
          const lines = trimmed.split("\n");
          const sepLineIndex = lines.findIndex((l) => /^\|?[\s:-]+\|/.test(l));
          if (sepLineIndex >= 0) {
            const headerCells = lines[sepLineIndex - 1]
              ?.split("|")
              .filter((c) => c.trim().length > 0)
              .map((c) => c.trim());
            const bodyLines = lines.slice(sepLineIndex + 1).filter((l) => l.trim());
            return (
              <div key={i} className="overflow-x-auto">
                <table className="w-full text-xs border-collapse border border-border">
                  {headerCells && headerCells.length > 0 && (
                    <thead>
                      <tr className="bg-secondary/50">
                        {headerCells.map((h, ci) => (
                          <th key={ci} className="border border-border px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap">
                            {renderInline(h)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {bodyLines.map((line, ri) => {
                      const cells = line
                        .split("|")
                        .filter((c) => c.trim().length > 0)
                        .map((c) => c.trim());
                      return (
                        <tr key={ri} className={ri % 2 === 0 ? "bg-background" : "bg-secondary/20"}>
                          {cells.map((c, ci) => (
                            <td key={ci} className="border border-border px-3 py-2 text-foreground whitespace-nowrap">
                              {renderInline(c)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          }
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
