'use client';

import * as React from 'react';
import { isClient } from '@/lib/utils';

const MOBILE_BREAKPOINT = 768;

function getSnapshot(): boolean {
  if (!isClient()) return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  if (!isClient()) return () => {};
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}