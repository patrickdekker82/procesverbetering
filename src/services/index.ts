import { getAiClient } from '../ai';
import { getDb } from '../db';
import { loadSettings } from '../db/repos/settingsRepo';
import { createImprovementService, type ImprovementService } from './improvementService';

let service: Promise<ImprovementService> | undefined;

export function getImprovementService(): Promise<ImprovementService> {
  service ??= (async () => {
    const db = await getDb();
    return createImprovementService({ db, ai: getAiClient(), getSettings: () => loadSettings(db) });
  })();
  return service;
}
