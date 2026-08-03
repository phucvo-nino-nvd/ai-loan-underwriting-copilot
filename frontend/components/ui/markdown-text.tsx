"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function MarkdownText({ text, className, sources }: { text: string; className?: string, sources?: string[] }) {
  const blocks = text.split(/\n{2,}/);

  // Pre-calculate sequential display numbers for citations (e.g., if AI cites [2] then [5], they display as 1 and 2)
  const uniqueCitations = Array.from(new Set(Array.from(text.matchAll(/(?:\[|【)(\d+)(?:\]|】)/g)).map(m => parseInt(m[1], 10))));
  const citationMap = new Map(uniqueCitations.map((originalNum, index) => [originalNum, index + 1]));

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
              {renderInline(content, sources, citationMap)}
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
                    {renderInline(item, sources, citationMap)}
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
                    {renderInline(item, sources, citationMap)}
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
                            {renderInline(h, sources, citationMap)}
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
                              {renderInline(c, sources, citationMap)}
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
          <p key={i} className="whitespace-pre-wrap leading-relaxed">
            {renderInline(trimmed, sources, citationMap)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string, sources?: string[], citationMap?: Map<number, number>): (string | React.ReactElement)[] {
  const parts: (string | React.ReactElement)[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[\d+\]|【\d+】)/g;
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
    } else if (token.match(/^(?:\[|【)(\d+)(?:\]|】)$/)) {
      const numStr = token.match(/\d+/)?.[0] ?? "1";
      const originalNum = parseInt(numStr, 10);
      const rawSource = sources && sources[originalNum - 1];
      const displayNum = citationMap?.get(originalNum) ?? originalNum;

      if (rawSource) {
        parts.push(<CitationBadge key={key} num={displayNum} rawSource={rawSource} />);
      } else {
        parts.push(
          <span key={key} className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-secondary text-muted-foreground mx-0.5 align-super text-[10px] font-bold">
            {displayNum}
          </span>
        );
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

const POPOVER_WIDTH = 480;
const POPOVER_GAP = 8;

/** Retrieved chunks are raw markdown. Reduce links to their label so the source reads as prose.
 *  Link labels may themselves contain escaped brackets — Wikipedia-derived policy documents cite
 *  footnotes as `[\[3\]](#cite_note-3)` — so the label pattern has to allow `\]` before unescaping. */
export function cleanMarkdown(source: string): string {
  return source
    .replace(/!?\[((?:[^[\]\\]|\\.)*)\]\([^)]*\)/g, "$1")
    .replace(/\\([\\`*_{}[\]()#+\-.!>|~])/g, "$1");
}

/** Where the popover sits, in viewport coordinates, plus the arrow offset within it. */
type Placement = { left: number; width: number; bottom: number; arrow: number };

/** Keep the popover inside the conversation column so it never covers the sidebar.
 *  Null once the badge has scrolled out of that column — the popover hides with it. */
function place(badge: HTMLElement): Placement | null {
  const rect = badge.getBoundingClientRect();
  const bounds = badge.closest("[data-citation-boundary]")?.getBoundingClientRect();
  if (bounds && (rect.bottom < bounds.top || rect.top > bounds.bottom)) return null;
  const min = bounds ? bounds.left : POPOVER_GAP;
  const max = bounds ? bounds.right : window.innerWidth - POPOVER_GAP;

  const width = Math.min(POPOVER_WIDTH, max - min);
  const center = rect.left + rect.width / 2;
  const left = Math.min(Math.max(min, center - width / 2), max - width);
  return { left, width, bottom: window.innerHeight - rect.top + POPOVER_GAP, arrow: center - left };
}

function CitationBadge({ num, rawSource }: { num: number; rawSource: string }) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPinned, setIsPinned] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [placement, setPlacement] = React.useState<Placement | null>(null);
  const badgeRef = React.useRef<HTMLSpanElement>(null);
  const popoverRef = React.useRef<HTMLSpanElement>(null);
  const closeTimer = React.useRef<number | null>(null);

  const cleanSource = cleanMarkdown(rawSource);

  // Badge and popover are in separate DOM trees, so crossing the gap between them
  // fires mouseleave before mouseenter. Close on a short delay to bridge it.
  const openOnHover = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setIsHovered(true);
  };
  const closeOnHover = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setIsHovered(false), 150);
  };
  React.useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (badgeRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setIsPinned(false);
    }
    if (isPinned) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPinned]);

  const isOpen = (isHovered || isPinned) && !expanded;

  // The popover is portalled to <body> and positioned in viewport coordinates: any
  // ancestor with a transform (the message enter animation) would otherwise make
  // `fixed` resolve against it, and `overflow-y-auto` on the log would clip it.
  React.useLayoutEffect(() => {
    if (!isOpen || !badgeRef.current) return;
    const badge = badgeRef.current;
    const update = () => setPlacement(place(badge));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isOpen]);

  return (
    <span
      ref={badgeRef}
      className="inline-block mx-0.5 align-super text-[10px]"
      onMouseEnter={openOnHover}
      onMouseLeave={closeOnHover}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setIsPinned(!isPinned);
        }}
        aria-label={`Source ${num}`}
        className={cn(
          "inline-flex items-center justify-center w-3.5 h-3.5 rounded-full font-bold cursor-pointer transition-all focus:outline-none",
          isOpen || expanded ? "bg-accent text-accent-foreground opacity-100 ring-2 ring-accent/30" : "bg-accent/80 text-accent-foreground hover:opacity-100"
        )}
      >
        {num}
      </button>

      {isOpen && placement && createPortal(
        <span
          ref={popoverRef}
          style={{ left: placement.left, bottom: placement.bottom, width: placement.width }}
          className="fixed z-50 animate-in fade-in zoom-in-95 duration-150"
          onMouseEnter={openOnHover}
          onMouseLeave={closeOnHover}
        >
          <span className="block bg-background rounded-lg shadow-2xl border border-border overflow-hidden">
            <span className="block max-h-72 overflow-y-auto overflow-x-hidden break-words whitespace-pre-wrap p-4 pr-10 text-foreground text-sm leading-relaxed text-left cursor-text" onClick={(e) => e.stopPropagation()}>
              {cleanSource}
            </span>
            <button
              type="button"
              onClick={() => { setExpanded(true); setIsPinned(false); setIsHovered(false); }}
              aria-label="Open source in full view"
              className="absolute top-2 right-2 p-1.5 rounded-md bg-secondary/90 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </span>
          <span
            style={{ left: placement.arrow }}
            className="absolute -bottom-1.5 -ml-1.5 w-3 h-3 bg-background border-b border-r border-border rotate-45"
          />
        </span>,
        document.body
      )}

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          overlayClassName="bg-black/70 backdrop-blur-sm"
          className="sm:max-w-2xl max-h-[85vh] grid-rows-[auto_1fr] rounded-lg"
        >
          <DialogHeader>
            <DialogTitle className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Source {num}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground pr-2">
            {cleanSource}
          </div>
        </DialogContent>
      </Dialog>
    </span>
  );
}

