import Database from 'better-sqlite3';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number.parseInt(process.env.PORT ?? '9999', 10);
const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'rune-dice.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS saves (
    slot TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const selectSave = db.prepare('SELECT slot, state_json, updated_at FROM saves WHERE slot = ?');
const upsertSave = db.prepare(`
  INSERT INTO saves (slot, state_json, updated_at)
  VALUES (?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(slot) DO UPDATE SET
    state_json = excluded.state_json,
    updated_at = CURRENT_TIMESTAMP
`);
const deleteSave = db.prepare('DELETE FROM saves WHERE slot = ?');

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/saves/:slot', (req, res) => {
  const slot = parseSlot(req.params.slot);
  if (!slot) {
    res.status(400).json({ error: 'invalid_slot' });
    return;
  }

  const row = selectSave.get(slot);
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  try {
    res.json({
      slot: row.slot,
      state: JSON.parse(row.state_json),
      updatedAt: row.updated_at,
    });
  } catch {
    res.status(500).json({ error: 'corrupt_save' });
  }
});

app.put('/api/saves/:slot', (req, res) => {
  const slot = parseSlot(req.params.slot);
  if (!slot) {
    res.status(400).json({ error: 'invalid_slot' });
    return;
  }

  if (!isSaveData(req.body)) {
    res.status(400).json({ error: 'invalid_save' });
    return;
  }

  upsertSave.run(slot, JSON.stringify(req.body ?? null));
  const row = selectSave.get(slot);
  res.json({
    slot: row.slot,
    state: JSON.parse(row.state_json),
    updatedAt: row.updated_at,
  });
});

app.delete('/api/saves/:slot', (req, res) => {
  const slot = parseSlot(req.params.slot);
  if (!slot) {
    res.status(400).json({ error: 'invalid_slot' });
    return;
  }

  deleteSave.run(slot);
  res.status(204).end();
});

app.use(express.static(distDir, {
  etag: true,
  maxAge: '1h',
}));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Rune Dice listening on port ${port}`);
});

function parseSlot(value) {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : null;
}

function isSaveData(value) {
  if (!isObject(value)) return false;
  if (value.version !== 1) return false;
  if (typeof value.savedAt !== 'string') return false;
  if (!Number.isFinite(value.seed)) return false;
  if (!['battle', 'reward', 'upgrade', 'victory', 'defeat'].includes(value.phase)) return false;
  if (!Number.isInteger(value.battleIndex) || value.battleIndex < 0) return false;
  if (!isPlayer(value.player)) return false;
  if (value.enemy !== null && !isEnemy(value.enemy)) return false;
  if (!Array.isArray(value.dice) || value.dice.length < 1 || value.dice.length > 10 || !value.dice.every(isDie)) return false;
  if (!Array.isArray(value.log) || value.log.some((line) => typeof line !== 'string')) return false;
  if (!Array.isArray(value.pendingRewards)) return false;
  return value.pendingDieUpgrade === null || isObject(value.pendingDieUpgrade);
}

function isPlayer(value) {
  return isObject(value)
    && Number.isFinite(value.maxHp)
    && Number.isFinite(value.hp)
    && Number.isFinite(value.armor)
    && Number.isFinite(value.gold)
    && Number.isFinite(value.rerollMax)
    && Number.isFinite(value.rerollsLeft)
    && Array.isArray(value.relics)
    && value.relics.every((id) => typeof id === 'string')
    && isObject(value.runeBonus);
}

function isEnemy(value) {
  return isObject(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && Number.isFinite(value.maxHp)
    && Number.isFinite(value.baseAttack)
    && Number.isFinite(value.hp)
    && Number.isFinite(value.armor)
    && Number.isFinite(value.turn)
    && typeof value.intent === 'string';
}

function isDie(value) {
  return isObject(value)
    && Array.isArray(value.faces)
    && value.faces.length > 0
    && value.faces.every(isRune)
    && isRune(value.value)
    && typeof value.locked === 'boolean'
    && typeof value.blocked === 'boolean'
    && typeof value.nextBlocked === 'boolean'
    && (value.nextForcedValue === null || isRune(value.nextForcedValue))
    && typeof value.forced === 'boolean';
}

function isRune(value) {
  return ['fire', 'water', 'stone', 'thunder', 'gold', 'dark', 'wild', 'curse'].includes(value);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
