import React from 'react';

/**
 * Parses inline markdown: **bold**, __bold__, `code`, *italic*, _italic_, and [link](url).
 */
export function renderInline(text) {
  if (!text) return null;

  const tokens = [];
  // Regex pattern matching:
  // 1 & 2: **bold**
  // 3 & 4: __bold__
  // 5 & 6: `code`
  // 7 & 8: *italic*
  // 9 & 10: _italic_
  // 11 & 12 & 13: [link text](url)
  const regex = /(\*\*([^*]+)\*\*)|(__([^_]+)__)|(`([^`]+)`)|(\*([^*]+)\*)|(_([^_]+)_)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.substring(lastIndex, match.index));
    }

    if (match[2] !== undefined) {
      // **bold**
      tokens.push(
        <strong key={key++} className="font-semibold text-white">
          {match[2]}
        </strong>
      );
    } else if (match[4] !== undefined) {
      // __bold__
      tokens.push(
        <strong key={key++} className="font-semibold text-white">
          {match[4]}
        </strong>
      );
    } else if (match[6] !== undefined) {
      // `code`
      tokens.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-amber-300 font-mono text-xs"
        >
          {match[6]}
        </code>
      );
    } else if (match[8] !== undefined) {
      // *italic*
      tokens.push(
        <em key={key++} className="italic text-neutral-200">
          {match[8]}
        </em>
      );
    } else if (match[10] !== undefined) {
      // _italic_
      tokens.push(
        <em key={key++} className="italic text-neutral-200">
          {match[10]}
        </em>
      );
    } else if (match[12] !== undefined && match[13] !== undefined) {
      // [link text](url)
      tokens.push(
        <a
          key={key++}
          href={match[13]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white underline hover:text-emerald-300 transition-colors"
        >
          {match[12]}
        </a>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.substring(lastIndex));
  }

  return tokens.length > 0 ? tokens : text;
}

/**
 * Parses block-level markdown into paragraphs, bullet lists, numbered lists, headings, and rules.
 */
function parseBlocks(markdown) {
  if (!markdown) return [];

  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let currentList = null;
  let currentPara = [];

  const flushPara = () => {
    if (currentPara.length > 0) {
      blocks.push({ type: 'p', text: currentPara.join(' ') });
      currentPara = [];
    }
  };

  const flushList = () => {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Blank line indicates separation
    if (!trimmed) {
      flushPara();
      flushList();
      continue;
    }

    // Horizontal Rule: --- or ***
    if (/^---$|^\*\*\*$/.test(trimmed)) {
      flushPara();
      flushList();
      blocks.push({ type: 'hr' });
      continue;
    }

    // Heading: #, ##, ###, ####
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      flushPara();
      flushList();
      blocks.push({
        type: 'heading',
        level: headerMatch[1].length,
        text: headerMatch[2],
      });
      continue;
    }

    // Bullet List Item: * item, - item, + item
    const bulletMatch = rawLine.match(/^(\s*)([\*\-\+])\s+(.*)$/);
    if (bulletMatch) {
      flushPara();
      const indent = bulletMatch[1].length;
      const text = bulletMatch[3];

      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push({ indent, text });
      continue;
    }

    // Numbered List Item: 1. item, 2. item
    const numMatch = rawLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (numMatch) {
      flushPara();
      const indent = numMatch[1].length;
      const num = numMatch[2];
      const text = numMatch[3];

      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push({ indent, num, text });
      continue;
    }

    // Regular text line inside paragraph
    if (currentList) {
      flushList();
    }
    currentPara.push(trimmed);
  }

  flushPara();
  flushList();
  return blocks;
}

/**
 * Lightweight, zero-dependency Markdown Renderer styled for Nokta Design System.
 */
export default function MarkdownRenderer({ content, className = '' }) {
  if (!content) {
    return <span className="text-neutral-500 italic">No response generated.</span>;
  }

  const blocks = parseBlocks(content);

  return (
    <div className={`space-y-3 font-sans leading-relaxed ${className}`}>
      {blocks.map((block, idx) => {
        if (block.type === 'hr') {
          return <hr key={idx} className="border-neutral-800/80 my-4" />;
        }

        if (block.type === 'heading') {
          switch (block.level) {
            case 1:
              return (
                <h2 key={idx} className="text-xl font-bold tracking-tight text-white mt-6 mb-3">
                  {renderInline(block.text)}
                </h2>
              );
            case 2:
              return (
                <h3 key={idx} className="text-lg font-semibold tracking-tight text-white mt-5 mb-2">
                  {renderInline(block.text)}
                </h3>
              );
            case 3:
              return (
                <h4 key={idx} className="text-base font-semibold tracking-tight text-neutral-100 mt-4 mb-1.5">
                  {renderInline(block.text)}
                </h4>
              );
            default:
              return (
                <h5 key={idx} className="text-sm font-semibold text-neutral-200 mt-3 mb-1">
                  {renderInline(block.text)}
                </h5>
              );
          }
        }

        if (block.type === 'ul') {
          return (
            <ul key={idx} className="space-y-1.5 my-2">
              {block.items.map((item, itemIdx) => {
                const isNested = item.indent >= 2;
                return (
                  <li
                    key={itemIdx}
                    className={`flex items-start ${
                      isNested ? 'ml-6 space-x-2 text-neutral-300' : 'space-x-2.5 text-neutral-200'
                    }`}
                  >
                    <span
                      className={`rounded-full shrink-0 mt-2 ${
                        isNested
                          ? 'w-1 h-1 bg-neutral-500'
                          : 'w-1.5 h-1.5 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                      }`}
                    />
                    <div className="flex-1 leading-relaxed text-sm">
                      {renderInline(item.text)}
                    </div>
                  </li>
                );
              })}
            </ul>
          );
        }

        if (block.type === 'ol') {
          return (
            <ol key={idx} className="space-y-1.5 my-2">
              {block.items.map((item, itemIdx) => (
                <li
                  key={itemIdx}
                  className="flex items-start space-x-2 text-neutral-200 text-sm"
                >
                  <span className="font-mono text-xs font-semibold text-neutral-400 mt-0.5 shrink-0 min-w-[1.2rem]">
                    {item.num}.
                  </span>
                  <div className="flex-1 leading-relaxed">
                    {renderInline(item.text)}
                  </div>
                </li>
              ))}
            </ol>
          );
        }

        // Paragraph
        return (
          <p key={idx} className="text-sm text-neutral-200 leading-relaxed">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
