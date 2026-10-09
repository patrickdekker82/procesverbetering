import { useCallback, useEffect, useState } from 'react';

/**
 * Loads data asynchronously and reloads on demand. `loader` null means "not ready yet".
 * Returns [data, reload]; data is null until the first load finishes.
 */
export function useLoad<T>(loader: (() => Promise<T>) | null): [T | null, () => void] {
  const [data, setData] = useState<T | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!loader) return;
    let cancelled = false;
    loader().then((value) => {
      if (!cancelled) setData(value);
    });
    return () => {
      cancelled = true;
    };
  }, [loader, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return [data, reload];
}
