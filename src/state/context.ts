import { createContext, useContext } from 'react';
import type { Settings } from '../core/settings';

export interface AppState {
  settings: Settings | null;
  keyPresent: boolean;
  loadError: string | null;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  refreshKeyStatus: () => Promise<void>;
}

export const AppStateContext = createContext<AppState | null>(null);

export function useAppState(): AppState {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}
