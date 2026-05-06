import type { GameState } from '../core/types';
import { emptySlots } from '../core/GameState';
import { LocalSaveProvider } from './LocalSaveProvider';
import { RemoteSaveProvider } from './RemoteSaveProvider';
import type { SaveData } from './SaveTypes';

const SAVE_VERSION = 1;

export class SaveManager {
  private readonly local = new LocalSaveProvider();
  private readonly remote: RemoteSaveProvider | null;

  constructor(remoteBase = import.meta.env.VITE_SAVE_API_BASE ?? '/api') {
    this.remote = remoteBase ? new RemoteSaveProvider(remoteBase.replace(/\/$/, '')) : null;
  }

  async load(slot: string): Promise<SaveData | null> {
    return this.loadLocal(slot);
  }

  async save(slot: string, state: GameState): Promise<void> {
    await this.saveLocal(slot, toSaveData(state));
  }

  async remove(slot: string): Promise<void> {
    await this.local.remove(slot);
  }

  async hasLocal(slot: string): Promise<boolean> {
    return (await this.loadLocal(slot)) !== null;
  }

  async loadLocal(slot: string): Promise<SaveData | null> {
    try {
      return await this.local.load(slot);
    } catch (error) {
      console.warn('本地存档读取失败，将开始新游戏。', error);
      return null;
    }
  }

  async saveLocal(slot: string, data: SaveData): Promise<void> {
    await this.local.save(slot, data);
  }

  async loadRemote(slot: string): Promise<SaveData | null> {
    if (!(await this.ensureRemoteAvailable()) || !this.remote) return null;
    try {
      return await this.remote.load(slot);
    } catch (error) {
      console.warn('远程存档读取失败，已忽略。', error);
      return null;
    }
  }

  async uploadLocal(slot: string): Promise<boolean> {
    const data = await this.loadLocal(slot);
    if (!data || !(await this.ensureRemoteAvailable()) || !this.remote) return false;
    try {
      await this.remote.save(slot, data);
      return true;
    } catch (error) {
      console.warn('远程存档上传失败。', error);
      return false;
    }
  }

  async syncRemoteToLocal(slot: string): Promise<boolean> {
    const data = await this.loadRemote(slot);
    if (!data) return false;
    await this.saveLocal(slot, data);
    return true;
  }

  private async ensureRemoteAvailable(): Promise<boolean> {
    if (!this.remote) return false;
    try {
      return await this.remote.health();
    } catch (error) {
      console.warn('远程服务不可用。', error);
      return false;
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
    slots: state.slots,
    selectedDieIndex: state.selectedDieIndex,
    log: state.log.slice(-20),
    pendingRewards: state.pendingRewards,
    pendingDieUpgrade: state.pendingDieUpgrade,
  };
}

export function applySaveData(data: SaveData): GameState {
  if (!data.slots) console.warn('旧存档缺少槽位字段，已按新玩法补齐默认槽位。');
  const player = {
    ...data.player,
    runeBonus: data.player.runeBonus ?? {},
    slotBonus: data.player.slotBonus ?? { attack: 0, defense: 0, tacticGold: 0 },
    nextTurnArmor: data.player.nextTurnArmor ?? 0,
    nextTurnExtraReroll: data.player.nextTurnExtraReroll ?? 0,
    darkEnergy: data.player.darkEnergy ?? 0,
  };
  return {
    seed: data.seed,
    phase: data.phase,
    battleIndex: data.battleIndex,
    player,
    enemy: data.enemy,
    dice: data.dice,
    slots: data.slots ?? emptySlots(),
    selectedDieIndex: data.selectedDieIndex ?? null,
    log: data.log,
    pendingRewards: data.pendingRewards,
    pendingDieUpgrade: data.pendingDieUpgrade,
  };
}
