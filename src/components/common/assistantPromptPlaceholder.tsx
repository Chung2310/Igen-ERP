import React from "react";

export function hasSquareBracketPlaceholders(value: string): boolean {
  return /\[[^\]\r\n]+\]/.test(value);
}

export function extractSquareBracketPlaceholders(value: string): string[] {
  const matches = value.match(/\[[^\]\r\n]+\]/g);
  if (!matches) return [];
  return Array.from(new Set(matches));
}

export function renderPromptWithPlaceholderHighlights(
  value: string,
  options?: { backgroundOnly?: boolean },
) {
  return value.split(/(\[[^\]\r\n]+\])/g).map((part, index) => {
    const isPlaceholder = part.startsWith("[") && part.endsWith("]");
    if (options?.backgroundOnly) {
      return isPlaceholder ? (
        <span
          key={index}
          className="rounded-md bg-primary/20 text-transparent font-medium ring-1 ring-primary/40 select-none"
        >
          {part}
        </span>
      ) : (
        <span key={index} className="opacity-0 select-none">
          {part}
        </span>
      );
    }
    return isPlaceholder ? (
      <span key={index} className="text-primary font-medium">
        {part}
      </span>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    );
  });
}
