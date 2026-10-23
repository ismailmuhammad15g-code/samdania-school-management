import React from 'react';

// A small, dependency-free Markdown renderer tuned for an elegant black & white
// look (no external libraries). Supports: headings, bold, italic, inline code,
// fenced code blocks, ordered/unordered lists, blockquotes, horizontal rules,
// links and GitHub-style tables.

function renderInline(text: string, prefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  const push = (s: string) => {
    if (s) nodes.push(s);
  };
  const re = /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) push(text.slice(last, m.index));
    const k = `${prefix}-inl-${i++}`;
    if (m[1] !== undefined) {
      nodes.push(
        <code key={k} className="bg-black/5 text-[13px] font-mono px-1 py-0.5 rounded">
          {m[1]}
        </code>
      );
    } else if (m[2] !== undefined) {
      nodes.push(
        <a
          key={k}
          href={m[3]}
          target="_blank"
          rel="noreferrer"
          className="underline font-medium text-black hover:opacity-70"
        >
          {m[2]}
        </a>
      );
    } else if (m[4] !== undefined) {
      nodes.push(
        <strong key={k} className="font-bold text-black">
          {m[4]}
        </strong>
      );
    } else if (m[5] !== undefined) {
      nodes.push(<em key={k}>{m[5]}</em>);
    } else if (m[6] !== undefined) {
      nodes.push(<em key={k}>{m[6]}</em>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) push(text.slice(last));
  return nodes;
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

function renderTable(header: string[], rows: string[][], key: string): React.ReactNode {
  return (
    <div key={key} className="overflow-x-auto my-3 rounded-lg border border-black/15">
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="bg-black/5">
            {header.map((h, i) => (
              <th key={i} className="border border-black/15 px-3 py-1.5 text-left font-semibold">
                {renderInline(h, `${key}-h${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className={ri % 2 ? 'bg-black/[0.02]' : ''}>
              {r.map((c, ci) => (
                <td key={ci} className="border border-black/15 px-3 py-1.5 align-top">
                  {renderInline(c, `${key}-${ri}-${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function parseBlocks(src: string): React.ReactNode[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out: React.ReactNode[] = [];
  let bidx = 0;
  const key = () => `md-b-${bidx++}`;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      i++;
      out.push(
        <pre
          key={key()}
          className="bg-black/[0.04] border border-black/10 rounded-lg p-3 overflow-x-auto my-2"
        >
          <code className="text-[13px] font-mono text-black/90">{code.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Heading
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const txt = renderInline(h[2], key());
      const cls =
        level === 1
          ? 'text-xl font-serif font-bold mt-1 mb-2'
          : level === 2
          ? 'text-lg font-serif font-semibold mt-1 mb-1.5'
          : level === 3
          ? 'text-base font-semibold mb-1'
          : 'text-sm font-semibold uppercase tracking-wide text-black/70 mb-1';
      out.push(React.createElement(`h${level}`, { key: key(), className: cls }, txt));
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
      out.push(<hr key={key()} className="border-t border-black/15 my-3" />);
      i++;
      continue;
    }

    // Blockquote
    if (line.trim().startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(
        <blockquote
          key={key()}
          className="border-l-2 border-black/30 pl-3 italic text-black/70 my-2"
        >
          {renderInline(quote.join(' '), key())}
        </blockquote>
      );
      continue;
    }

    // Table
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      lines[i + 1].includes('-') &&
      /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])
    ) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push(renderTable(header, rows, key()));
      continue;
    }

    // Lists
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (
        i < lines.length &&
        (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))
      ) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        i++;
      }
      const listItems = items.map((it, idx) => (
        <li key={idx} className="ml-1">
          {renderInline(it, key())}
        </li>
      ));
      out.push(
        ordered ? (
          <ol key={key()} className="list-decimal pl-6 space-y-1 my-2 marker:font-medium">
            {listItems}
          </ol>
        ) : (
          <ul key={key()} className="list-disc pl-6 space-y-1 my-2 marker:text-black/60">
            {listItems}
          </ul>
        )
      );
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^(\s*[-*_]){3,}\s*$/.test(lines[i]) &&
      !lines[i].trim().startsWith('>') &&
      !(
        lines[i].includes('|') &&
        i + 1 < lines.length &&
        lines[i + 1].includes('-') &&
        /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])
      ) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(
      <p key={key()} className="text-[14px] leading-relaxed text-black/85">
        {renderInline(para.join(' '), key())}
      </p>
    );
  }

  return out;
}

export default function Markdown({ content, className = '' }: { content: string; className?: string }) {
  const blocks = parseBlocks(content || '');
  return <div className={`text-black/85 space-y-3 ${className}`}>{blocks}</div>;
}
