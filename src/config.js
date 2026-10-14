import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { id, integer, UserError } from './utils/validation.js';

export function environment(env = process.env, requireToken = true) {
  const cfg = {
    token: env.DISCORD_TOKEN, clientId: id(env.DISCORD_CLIENT_ID), guildId: id(env.DISCORD_GUILD_ID),
    owners: (env.BOT_OWNER_IDS || '').split(',').filter(Boolean).map(x => id(x.trim())),
    ownerRoles: (env.BOT_OWNER_ROLE_IDS || '').split(',').filter(Boolean).map(x => id(x.trim())),
    database: resolve(env.DATABASE_PATH || './data/rlrp.sqlite'), configPath: resolve(env.CONFIG_PATH || './config/default.json'),
    fivemUrl: env.FIVEM_BASE_URL || null, joinUrl: env.FIVEM_JOIN_URL || null
  };
  if (requireToken && !cfg.token) throw new Error('DISCORD_TOKEN ontbreekt.');
  if (!cfg.owners.length && !cfg.ownerRoles.length) throw new Error('BOT_OWNER_IDS of BOT_OWNER_ROLE_IDS moet expliciete beheerders bevatten.');
  if (cfg.ownerRoles.includes(cfg.guildId)) throw new Error('@everyone mag geen ownerrol zijn.');
  if (cfg.fivemUrl) {
    const u = new URL(cfg.fivemUrl);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash) throw new Error('FiveM: ongeldige basis-URL.');
    cfg.fivemUrl = u.href.replace(/\/$/, '');
  }
  if (cfg.joinUrl && !/^https:\/\/cfx\.re\/join\/[a-z0-9]+$/i.test(cfg.joinUrl)) throw new Error('FIVEM_JOIN_URL moet een echte https://cfx.re/join/... URL zijn.');
  return cfg;
}
export const loadDefaults = path => validateConfig(JSON.parse(readFileSync(path, 'utf8')));
const keys = (obj, allowed) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new UserError('Een configuratieobject is vereist.');
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) throw new UserError(`Onbekende configuratiesleutel: ${k}`);
};
const ids = value => {
  if (!Array.isArray(value) || value.length > 100 || new Set(value).size !== value.length) throw new UserError('Gebruik een lijst met maximaal 100 unieke IDs.');
  value.forEach(id);
};
const bool = x => { if (typeof x !== 'boolean') throw new UserError('Boolean vereist.'); };
export function validateConfig(c) {
  keys(c, ['brand','roles','channels','staff','moderation','logging','fivem','permissions','security']);
  keys(c.brand, ['name','color','errorColor','logoEmojiId','upvoteEmojiId','downvoteEmojiId']);
  if(!Object.hasOwn(c.brand,'downvoteEmojiId')) c.brand.downvoteEmojiId=null;
  if (!c.brand.name || c.brand.name.length > 80) throw new UserError('Huisstijlnaam: 1–80 tekens.');
  for (const k of ['color','errorColor']) if (!/^#[a-f0-9]{6}$/i.test(c.brand[k])) throw new UserError('Kleur moet #RRGGBB zijn.');
  for (const k of ['logoEmojiId','upvoteEmojiId','downvoteEmojiId']) if (c.brand[k] !== null) id(c.brand[k]);
  keys(c.roles, ['management','moderator','support','protected','ranks']);
  ['management','moderator','support','protected'].forEach(k => ids(c.roles[k]));
  if (!Array.isArray(c.roles.ranks) || c.roles.ranks.length > 25) throw new UserError('Maximaal 25 ranks.');
  const names = new Set(), roleIds = new Set();
  for (const r of c.roles.ranks) {
    keys(r, ['name','roleId','level']); id(r.roleId); integer(r.level, 1, 1000);
    if (typeof r.name !== 'string' || !/^[\p{L}\p{N} _-]{1,50}$/u.test(r.name) || names.has(r.name.toLowerCase()) || roleIds.has(r.roleId)) throw new UserError('Ranks hebben unieke namen en rollen nodig.');
    names.add(r.name.toLowerCase()); roleIds.add(r.roleId);
  }
  keys(c.channels, ['hiring','dismissal','staffUpdates','changelog','giveaway','events','rules','fivem','staffWarnings','moderation','staff','security','messages','roles','channelChanges','members','system']);
  Object.values(c.channels).filter(x => x !== null).forEach(id);
  keys(c.staff, ['dm','removeRolesOnDismissal']); Object.values(c.staff).forEach(bool);
  keys(c.moderation, ['dm','temporaryBans']); Object.values(c.moderation).forEach(bool);
  keys(c.logging, ['messageContent','retentionDays']); bool(c.logging.messageContent); integer(c.logging.retentionDays, 7, 3650);
  keys(c.fivem, ['showPlayers','pollSeconds']); bool(c.fivem.showPlayers); integer(c.fivem.pollSeconds, 30, 3600);
  keys(c.permissions, Object.keys(c.permissions));
  for (const [name, p] of Object.entries(c.permissions)) {
    if (!/^[a-z][a-z0-9_-]{1,31}(\.[a-z][a-z0-9_-]{1,31})?$/.test(name) || name.startsWith('setup') || name.startsWith('antinuke') || name.startsWith('systeem')) throw new UserError('Ongeldige of owner-only commandoverride.');
    ids(p);
  }
  keys(c.security, ['action','allowUsers','allowBots','rules','spam','mentions','raid','webhookMessages']);
  if (!['strip','timeout','alert'].includes(c.security.action)) throw new UserError('Security action: strip, timeout of alert.');
  ids(c.security.allowUsers); ids(c.security.allowBots);
  const rules = ['channelCreate','channelDelete','channelUpdate','roleCreate','roleDelete','roleUpdate','webhook','ban','kick','guildUpdate'];
  keys(c.security.rules, rules);
  for (const rule of rules) {
    keys(c.security.rules[rule], ['limit','windowSeconds']); integer(c.security.rules[rule].limit, 1, 50); integer(c.security.rules[rule].windowSeconds, 5, 300);
  }
  for (const key of ['spam','mentions','raid','webhookMessages']) {
    const r = c.security[key];
    keys(r, key === 'mentions' ? ['limit','timeoutSeconds'] : key === 'webhookMessages' ? ['limit','windowSeconds'] : ['limit','windowSeconds','timeoutSeconds']);
    integer(r.limit, 2, 100);
    if ('windowSeconds' in r) integer(r.windowSeconds, 3, 300);
    if ('timeoutSeconds' in r) integer(r.timeoutSeconds, 60, 86400);
  }
  return structuredClone(c);
}
