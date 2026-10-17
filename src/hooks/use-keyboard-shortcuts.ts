'use client';

import * as React from 'react';

export type KeyModifier = 'cmd' | 'ctrl' | 'shift' | 'alt' | 'meta';

export interface ShortcutDefinition {
  key: string;
  modifiers?: KeyModifier[];
  handler: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  enabled?: boolean;
}

function matchesModifier(event: KeyboardEvent, modifier: KeyModifier): boolean {
  switch (modifier) {
    case 'cmd':
    case 'meta':
      return event.metaKey;
    case 'ctrl':
      return event.ctrlKey;
    case 'shift':
      return event.shiftKey;
    case 'alt':
      return event.altKey;
  }
}

function matchesAll(event: KeyboardEvent, modifiers?: KeyModifier[]): boolean {
  if (!modifiers || modifiers.length === 0) {
    return !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }
  return modifiers.every((m) => matchesModifier(event, m));
}

export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]): void {
  const handlerRef = React.useRef<(event: KeyboardEvent) => void>(() => {});

  React.useEffect(() => {
    handlerRef.current = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;
        if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) continue;
        if (!matchesAll(event, shortcut.modifiers)) continue;
        if (shortcut.preventDefault ?? true) event.preventDefault();
        if (shortcut.stopPropagation ?? false) event.stopPropagation();
        shortcut.handler(event);
      }
    };
  });

  React.useEffect(() => {
    const listener = (event: KeyboardEvent) => handlerRef.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}