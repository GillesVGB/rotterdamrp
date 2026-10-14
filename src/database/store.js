import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { validateConfig,fixedChannels } from '../config.js';
import { UserError } from '../utils/validation.js';

export class Store {
  constructor(path = ':memory:') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path, { timeout: 5000, allowExtension: false });
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS migrations(version TEXT PRIMARY KEY);');
    const folder = fileURLToPath(new URL('./migrations/', import.meta.url));
    for (const file of readdirSync(folder).filter(x => x.endsWith('.sql')).sort()) {
      if (!this.get('SELECT version FROM migrations WHERE version=?', file)) this.transaction(() => {
        this.db.exec(readFileSync(join(folder, file), 'utf8')); this.run('INSERT INTO migrations VALUES (?)', file);
      });
    }
    if (this.get('PRAGMA quick_check').quick_check !== 'ok') throw new Error('SQLite integriteitscontrole mislukt.');
  }
  run(sql, ...args) { return this.db.prepare(sql).run(...args); }
  get(sql, ...args) { return this.db.prepare(sql).get(...args); }
  all(sql, ...args) { return this.db.prepare(sql).all(...args); }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); if (result instanceof Promise) throw new Error('Geen async werk in SQLite-transacties.'); this.db.exec('COMMIT'); return result; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  init(guild, defaults) { this.run('INSERT OR IGNORE INTO config(guild_id,body) VALUES (?,?)', guild, JSON.stringify(validateConfig(defaults))); }
  config(guild) {
    const row = this.get('SELECT * FROM config WHERE guild_id=?', guild);
    if (!row) throw new Error('Guildconfiguratie ontbreekt.');
    const c=validateConfig(JSON.parse(row.body));
    return { ...c, channels:fixedChannels(guild,c.channels), revision: row.revision };
  }
  saveConfig(guild, config, revision) {
    const c=validateConfig(config),body = JSON.stringify({...c,channels:fixedChannels(guild,c.channels)});
    if (!this.run('UPDATE config SET body=?,revision=revision+1 WHERE guild_id=? AND revision=?', body, guild, revision).changes) throw new UserError('Configuratie is intussen gewijzigd. Exporteer de nieuwste versie en probeer opnieuw.');
  }
  begin(guild, actor, target, kind, details = {}) {
    const action = randomUUID();
    this.run('INSERT INTO actions VALUES (?,?,?,?,?,?,?,?,NULL)', action, guild, actor, target, kind, 'executing', JSON.stringify(details), Date.now());
    return action;
  }
  finish(action, state = 'completed', error = null) { this.run('UPDATE actions SET state=?,error=? WHERE id=?', state, error, action); }
  recover() { return this.run("UPDATE actions SET state='uncertain' WHERE state='executing'").changes; }
  hit(guild, actor, rule, windowMs, now = Date.now()) {
    return this.transaction(() => {
      this.run('INSERT INTO hits(guild_id,actor,rule,created_at) VALUES (?,?,?,?)', guild, actor, rule, now);
      return this.get('SELECT COUNT(*) AS n FROM hits WHERE guild_id=? AND actor=? AND rule=? AND created_at>=?', guild, actor, rule, now - windowMs).n;
    });
  }
  onceAudit(entry, now = Date.now()) { return !!this.run('INSERT OR IGNORE INTO audit_seen VALUES (?,?)', entry, now).changes; }
  queue(guild, channel, payload, key = randomUUID()) {
    this.run('INSERT OR IGNORE INTO outbox(id,guild_id,channel_id,payload,next_at,created_at) VALUES (?,?,?,?,?,?)', key, guild, channel, JSON.stringify(payload), Date.now(), Date.now()); return key;
  }
  joinGiveaway(giveaway, user, now = Date.now()) {
    return this.transaction(() => {
      const g = this.get('SELECT * FROM giveaways WHERE id=?', giveaway);
      if (!g || g.state !== 'active' || g.ends_at <= now) throw new UserError('Deze giveaway is gesloten.');
      return !!this.run('INSERT OR IGNORE INTO giveaway_entries VALUES (?,?,?)', giveaway, user, now).changes;
    });
  }
  joinEvent(event, user, now = Date.now()) {
    return this.transaction(() => {
      const e = this.get('SELECT * FROM events WHERE id=?', event);
      if (!e || e.state !== 'scheduled' || e.starts_at <= now) throw new UserError('Aanmelden is gesloten.');
      if (this.get('SELECT 1 FROM event_entries WHERE event_id=? AND user_id=?', event, user)) return false;
      if (this.get('SELECT COUNT(*) AS n FROM event_entries WHERE event_id=?', event).n >= e.capacity) throw new UserError('Dit evenement is vol.');
      this.run('INSERT INTO event_entries VALUES (?,?,?)', event, user, now); return true;
    });
  }
  close() { this.db.close(); }
}
