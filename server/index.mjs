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

  res.json({
    slot: row.slot,
    state: JSON.parse(row.state_json),
    updatedAt: row.updated_at,
  });
});

app.put('/api/saves/:slot', (req, res) => {
  const slot = parseSlot(req.params.slot);
  if (!slot) {
    res.status(400).json({ error: 'invalid_slot' });
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
