import { useEffect, useState } from 'react';
import { getImprovementService } from '../../services';
import type { ImprovementService } from '../../services/improvementService';

export function useImprovementService(): ImprovementService | null {
  const [service, setService] = useState<ImprovementService | null>(null);
  useEffect(() => {
    let cancelled = false;
    getImprovementService().then((s) => {
      if (!cancelled) setService(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return service;
}
