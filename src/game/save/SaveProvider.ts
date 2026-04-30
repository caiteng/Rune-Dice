import type { SaveData } from './SaveTypes';

export interface SaveProvider {
  load(slot: string): Promise<SaveData | null>;
  save(slot: string, data: SaveData): Promise<void>;
  remove(slot: string): Promise<void>;
}
