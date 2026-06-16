import type { SaveProvider } from './SaveProvider';
import type { SaveData } from './SaveTypes';

export class RemoteSaveProvider implements SaveProvider {
  constructor(private readonly baseUrl: string) {}

  async load(slot: string): Promise<SaveData | null> {
    const response = await fetch(`${this.baseUrl}/saves/${encodeURIComponent(slot)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`远程读取失败：${response.status}`);
    const body = (await response.json()) as { state?: SaveData };
    return body.state ?? null;
  }

  async save(slot: string, data: SaveData): Promise<void> {
    const response = await fetch(`${this.baseUrl}/saves/${encodeURIComponent(slot)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`远程保存失败：${response.status}`);
  }

  async remove(slot: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/saves/${encodeURIComponent(slot)}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) throw new Error(`远程删除失败：${response.status}`);
  }

  async health(): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.ok;
  }
}
