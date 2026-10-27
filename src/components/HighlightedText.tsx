import React from 'react';
import {
  HIGHLIGHT_MARK_CLASSES,
  splitTextIntoHighlightedSegments,
} from '../utils/consensusEngine';

export function selectElementContents(element: HTMLElement | null): void {
  if (!element || typeof document === 'undefined' || !document.createRange) return;
  const selection = window.getSelection ? window.getSelection() : null;
  if (!selection) return;
  try {
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
  } catch {
    // Ignore selection errors in restricted browsers
  }
}

interface HighlightedTextProps {
  text: string;
  searchQuery: string;
  className?: string;
  selectable?: boolean;
  title?: string;
}

export const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  searchQuery,
  className = '',
  selectable = false,
  title,
}) => {
  const segments = splitTextIntoHighlightedSegments(text, searchQuery);

  const handleClick = selectable
    ? (e: React.MouseEvent<HTMLSpanElement>) => {
        e.preventDefault();
        e.stopPropagation();
        selectElementContents(e.currentTarget);
      }
    : undefined;

  return (
    <span
      className={`${selectable ? 'cursor-text select-all ' : ''}${className}`}
      onClick={handleClick}
      title={title}
    >
      {segments.map((seg, idx) => {
        if (!seg.highlighted) {
          return <React.Fragment key={idx}>{seg.text}</React.Fragment>;
        }
        const colorClass =
          HIGHLIGHT_MARK_CLASSES[(seg.lineIndex ?? 0) % HIGHLIGHT_MARK_CLASSES.length];
        return (
          <mark
            key={idx}
            className={`rounded px-1 py-0.5 border font-semibold ${colorClass}`}
            title={`Recherche ligne ${(seg.lineIndex ?? 0) + 1} : ${seg.termText ?? ''}`}
          >
            {seg.text}
          </mark>
        );
      })}
    </span>
  );
};
