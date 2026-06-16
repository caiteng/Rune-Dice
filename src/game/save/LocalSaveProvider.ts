import type { SaveProvider } from './SaveProvider';
import type { SaveData } from './SaveTypes';

export class LocalSaveProvider implements SaveProvider {
  constructor(private readonly prefix = 'rune-dice-save') {}

  async load(slot: string): Promise<SaveData | null> {
    const raw = localStorage.getItem(this.key(slot));
    return raw ? (JSON.parse(raw) as SaveData) : null;
  }

  async save(slot: string, data: SaveData): Promise<void> {
    localStorage.setItem(this.key(slot), JSON.stringify(data));
  }

  async remove(slot: string): Promise<void> {
    localStorage.removeItem(this.key(slot));
  }

  private key(slot: string) {
    return `${this.prefix}:${slot}`;
  }
}
