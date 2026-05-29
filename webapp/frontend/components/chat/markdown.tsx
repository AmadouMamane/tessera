"use client";

import { cn } from "@/lib/cn";

type InlineNode =
  | string
  | { bold: string }
  | { italic: string }
  | { code: string };

type Block =
  | { type: "p"; text: string }
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "hr" };

function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const b = m[1], i = m[2], c = m[3];
    if (b !== undefined) nodes.push({ bold: b });
    else if (i !== undefined) nodes.push({ italic: i });
    else if (c !== undefined) nodes.push({ code: c });
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderInline(text: string, keyPrefix: string) {
  return parseInline(text).map((n, i) => {
    const k = `${keyPrefix}-${i}`;
    if (typeof n === "string") return n;
    if ("bold" in n)
      return (
        <strong key={k} className="font-semibold">
          {n.bold}
        </strong>
      );
    if ("italic" in n) return <em key={k}>{n.italic}</em>;
    return (
      <code
        key={k}
        className="rounded bg-[var(--muted)] px-1 py-0.5 font-mono text-[0.85em] text-[var(--foreground)]"
      >
        {n.code}
      </code>
    );
  });
}

const UL_RE = /^[-*•] /;
const OL_RE = /^\d+\. /;
const HR_RE = /^[-*_]{3,}$/;

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    const h3 = /^### (.+)/.exec(line);
    const h2 = !h3 && /^## (.+)/.exec(line);
    const h1 = !h3 && !h2 && /^# (.+)/.exec(line);

    if (h3?.[1]) { blocks.push({ type: "h3", text: h3[1] }); i++; continue; }
    if (h2 && h2[1]) { blocks.push({ type: "h2", text: h2[1] }); i++; continue; }
    if (h1 && h1[1]) { blocks.push({ type: "h1", text: h1[1] }); i++; continue; }

    if (HR_RE.test(line.trim())) { blocks.push({ type: "hr" }); i++; continue; }

    if (UL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UL_RE.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(UL_RE, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (OL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && OL_RE.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(OL_RE, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    if (line.trim() === "") { i++; continue; }

    const paraLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i] ?? "";
      if (
        l.trim() === "" ||
        /^#{1,3} /.test(l) ||
        UL_RE.test(l) ||
        OL_RE.test(l) ||
        HR_RE.test(l.trim())
      ) break;
      paraLines.push(l);
      i++;
    }
    if (paraLines.length) blocks.push({ type: "p", text: paraLines.join(" ") });
  }

  return blocks;
}

interface MarkdownProps {
  children: string;
  className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
  const blocks = parseBlocks(children);

  return (
    <div className={cn("space-y-2 text-sm leading-relaxed", className)}>
      {blocks.map((block, bi) => {
        const key = `b${bi}`;
        switch (block.type) {
          case "h1":
            return <p key={key} className="text-base font-bold">{renderInline(block.text, key)}</p>;
          case "h2":
            return <p key={key} className="font-bold">{renderInline(block.text, key)}</p>;
          case "h3":
            return <p key={key} className="font-semibold">{renderInline(block.text, key)}</p>;
          case "p":
            return <p key={key}>{renderInline(block.text, key)}</p>;
          case "ul":
            return (
              <ul key={key} className="ml-4 list-disc space-y-0.5 marker:text-[var(--muted-foreground)]">
                {block.items.map((item, ii) => (
                  <li key={ii}>{renderInline(item, `${key}-${ii}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key} className="ml-4 list-decimal space-y-0.5 marker:text-[var(--muted-foreground)]">
                {block.items.map((item, ii) => (
                  <li key={ii}>{renderInline(item, `${key}-${ii}`)}</li>
                ))}
              </ol>
            );
          case "hr":
            return <hr key={key} className="border-[var(--border)]" />;
        }
      })}
    </div>
  );
}
