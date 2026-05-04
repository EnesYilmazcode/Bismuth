import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

interface StreamingCodeBlockProps {
  code: string;
  isStreaming: boolean;
  filename?: string;
}

// Keep it compact — stays inside the chat bubble without swallowing the view.
const MAX_HEIGHT = 180;

// Typewriter reveal: ~300 chars/sec feels live without being frantic.
const REVEAL_CHARS_PER_TICK = 8;
const REVEAL_TICK_MS = 28;

export function StreamingCodeBlock({
  code,
  isStreaming,
  filename = 'model.scad',
}: StreamingCodeBlockProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [visibleCount, setVisibleCount] = useState(0);

  // Catch up to the incoming stream at a readable pace. Scale with backlog
  // so very long responses finish in ~1.5s rather than tens of seconds.
  useEffect(() => {
    if (visibleCount >= code.length) return;
    const backlog = code.length - visibleCount;
    const step = isStreaming
      ? Math.max(REVEAL_CHARS_PER_TICK, Math.ceil(backlog / 60))
      : Math.max(REVEAL_CHARS_PER_TICK, Math.ceil(code.length / 40));
    const id = window.setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + step, code.length));
    }, REVEAL_TICK_MS);
    return () => window.clearTimeout(id);
  }, [code, visibleCount, isStreaming]);

  const visibleCode = useMemo(
    () => code.slice(0, visibleCount),
    [code, visibleCount],
  );

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [visibleCode]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 16;
  };

  const revealing = visibleCount < code.length;
  const showCaret = isStreaming || revealing;

  return (
    <div className="w-full overflow-hidden rounded-lg border border-white/[0.06] bg-adam-neutral-950/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex h-7 items-center justify-between gap-3 border-b border-white/[0.06] px-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-adam-neutral-400">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-adam-blue/80" />
          <span className="truncate">{filename}</span>
        </div>
        {showCaret && (
          <div className="flex shrink-0 items-center gap-1.5 text-[10.5px] text-adam-neutral-500">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-adam-blue/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-adam-blue" />
            </span>
            streaming
          </div>
        )}
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="overflow-auto px-3 py-2.5 font-mono text-[11.5px] leading-[1.55] text-adam-text-primary/95"
          style={{ maxHeight: MAX_HEIGHT }}
        >
          <pre className="m-0 whitespace-pre-wrap break-words">
            <code>{visibleCode}</code>
            {showCaret && (
              <span
                aria-hidden
                className="ml-[1px] inline-block h-[0.95em] w-[0.5ch] translate-y-[2px] animate-pulse rounded-[1px] bg-adam-blue/90 align-middle"
              />
            )}
          </pre>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-adam-neutral-950 to-transparent"
        />
      </div>
    </div>
  );
}
