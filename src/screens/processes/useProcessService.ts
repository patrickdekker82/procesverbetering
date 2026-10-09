import { useEffect, useState } from 'react';
import { getProcessService } from '../../services';
import type { ProcessService } from '../../services/processService';

export function useProcessService(): ProcessService | null {
  const [service, setService] = useState<ProcessService | null>(null);
  useEffect(() => {
    let cancelled = false;
    getProcessService().then((s) => {
      if (!cancelled) setService(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return service;
}
