import type { GameState } from '../core/types';
import { LocalSaveProvider } from './LocalSaveProvider';
import { RemoteSaveProvider } from './RemoteSaveProvider';
import type { SaveData } from './SaveTypes';

const SAVE_VERSION = 1;

export class SaveManager {
  private readonly local = new LocalSaveProvider();
  private readonly remote: RemoteSaveProvider | null;
  private remoteAvailable: boolean | null = null;

  constructor(remoteBase = import.meta.env.VITE_SAVE_API_BASE ?? '/api') {
    this.remote = remoteBase ? new RemoteSaveProvider(remoteBase.replace(/\/$/, '')) : null;
  }

  async load(slot: string): Promise<SaveData | null> {
    const localData = await this.safeLocalLoad(slot);
    void this.tryRemoteLoad(slot);
    return localData;
  }

  async save(slot: string, state: GameState): Promise<void> {
    const data = toSaveData(state);
    await this.local.save(slot, data);
    void this.tryRemoteSave(slot, data);
  }

  async remove(slot: string): Promise<void> {
    await this.local.remove(slot);
    if (!this.remote) return;
    try {
      await this.remote.remove(slot);
    } catch (error) {
      console.warn('远程存档删除失败，已忽略。', error);
    }
  }

  private async safeLocalLoad(slot: string) {
    try {
      return await this.local.load(slot);
    } catch (error) {
      console.warn('本地存档读取失败，将开始新游戏。', error);
      return null;
    }
  }

  private async ensureRemoteAvailable() {
    if (!this.remote) return false;
    if (this.remoteAvailable !== null) return this.remoteAvailable;
    try {
      this.remoteAvailable = await this.remote.health();
    } catch (error) {
      this.remoteAvailable = false;
      console.warn('远程存档服务不可用，将使用本地存档。', error);
    }
    return this.remoteAvailable;
  }

  private async tryRemoteLoad(slot: string) {
    if (!(await this.ensureRemoteAvailable()) || !this.remote) return null;
    try {
      return await this.remote.load(slot);
    } catch (error) {
      console.warn('远程存档读取失败，继续使用本地存档。', error);
      return null;
    }
  }

  private async tryRemoteSave(slot: string, data: SaveData) {
    if (!(await this.ensureRemoteAvailable()) || !this.remote) return;
    try {
      await this.remote.save(slot, data);
    } catch (error) {
      console.warn('远程存档上传失败，本地存档已保留。', error);
    }
  }
}

export function toSaveData(state: GameState): SaveData {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    seed: state.seed,
    phase: state.phase,
    battleIndex: state.battleIndex,
    player: state.player,
    enemy: state.enemy,
    dice: state.dice,
    log: state.log.slice(-20),
    pendingRewards: state.pendingRewards,
    pendingDieUpgrade: state.pendingDieUpgrade,
  };
}

export function applySaveData(data: SaveData): GameState {
  return {
    seed: data.seed,
    phase: data.phase,
    battleIndex: data.battleIndex,
    player: data.player,
    enemy: data.enemy,
    dice: data.dice,
    log: data.log,
    pendingRewards: data.pendingRewards,
    pendingDieUpgrade: data.pendingDieUpgrade,
  };
}
