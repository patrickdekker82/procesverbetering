import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { hasApiKey } from '../ai/apiKey';
import type { Settings } from '../core/settings';
import { getDb } from '../db';
import { loadSettings, saveSettings } from '../db/repos/settingsRepo';

import { AppStateContext as Ctx } from './context';

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [keyPresent, setKeyPresent] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshKeyStatus = useCallback(async () => {
    setKeyPresent(await hasApiKey().catch(() => false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadSettings(await getDb());
        if (!cancelled) setSettings(loaded);
      } catch (error) {
        if (!cancelled) setLoadError(`De database kon niet worden geopend: ${String(error)}`);
      }
      const present = await hasApiKey().catch(() => false);
      if (!cancelled) setKeyPresent(present);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings(await saveSettings(await getDb(), patch));
  }, []);

  const value = useMemo(
    () => ({ settings, keyPresent, loadError, updateSettings, refreshKeyStatus }),
    [settings, keyPresent, loadError, updateSettings, refreshKeyStatus],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
