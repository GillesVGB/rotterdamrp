import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setImmediate } from 'node:timers/promises';
import { Events, AuditLogEvent, Collection } from 'discord.js';
import { wireEvents, logAuditEntry } from '../src/events/index.js';
import { fixture, IDs } from './fixture.js';

function eventFixture() {
  const f = fixture(), bus = new EventEmitter();
  f.ctx.client.on = bus.on.bind(bus);
  wireEvents(f.ctx);
  return { ...f, bus, async fire(event, ...args) { bus.emit(event, ...args); await setImmediate(); } };
}

function assertNoAutomaticActions(f) {
  assert.equal(f.records.filter(record => record.add || record.remove || record.timeout || record.kick || record.ban || record.unban).length, 0);
  assert.equal(f.store.all('SELECT * FROM sanctions').length, 0);
  assert.equal(f.store.all('SELECT * FROM actions').length, 0);
  assert.equal(f.store.all('SELECT * FROM hits').length, 0);
  assert.equal(f.members.has(IDs.target), true);
}

test('herhaalde botjoins, massamentions en webhookevents voeren uitsluitend gewone logging uit', async () => {
  const f = eventFixture();
  try {
    assert.equal(Object.hasOwn(f.ctx, 'security'), false);
    assert.equal(f.bus.listenerCount(Events.MessageCreate), 0);
    let messageDeletes = 0, webhookDeletes = 0;
    f.ctx.client.fetchWebhook = async () => ({ delete: async () => { webhookDeletes++; } });
    f.target.user.bot = true;
    const message = {
      guild: f.guild, author: f.target.user, member: f.target, content: '@everyone @here',
      id: '123456789012345710', channelId: IDs.channel, webhookId: '123456789012345711',
      mentions: { everyone: true, users: new Collection(), roles: new Collection() },
      deletable: true, delete: async () => { messageDeletes++; }
    };
    for (let index = 0; index < 60; index++) {
      f.bus.emit(Events.GuildMemberAdd, f.target);
      f.bus.emit(Events.MessageCreate, message);
      f.bus.emit(Events.WebhooksUpdate, f.channel);
      f.bus.emit(Events.MessageUpdate, { ...message, content: 'vorig bericht' }, message);
    }
    await setImmediate();
    assert.equal(messageDeletes, 0);
    assert.equal(webhookDeletes, 0);
    const logs = f.records.filter(record => record.log).map(record => record.log);
    assert.equal(logs.filter(row => row[2] === 'Lid toegetreden').length, 60);
    assert.equal(logs.filter(row => row[2] === 'Webhookwijziging waargenomen').length, 60);
    assert.equal(logs.filter(row => row[2] === 'Bericht aangepast').length, 60);
    assertNoAutomaticActions(f);
  } finally { f.store.close(); }
});

test('gewone events behouden leden-, rollen-, kanaal-, bericht-, ban- en serverlogs', async () => {
  const f = eventFixture();
  try {
    const role = f.roles.get(IDs.mod), message = { guild: f.guild, author: f.target.user, channelId: IDs.channel, id: '123456789012345710', content: 'Interne berichtinhoud' };
    const oldMember = { ...f.target, roles: { cache: new Collection([[IDs.guild, f.roles.get(IDs.guild)]]) } };
    await f.fire(Events.GuildMemberRemove, f.target);
    await f.fire(Events.GuildMemberUpdate, oldMember, f.target);
    await f.fire(Events.ChannelCreate, f.channel);
    await f.fire(Events.ChannelDelete, f.channel);
    await f.fire(Events.ChannelUpdate, f.channel, f.channel);
    await f.fire(Events.GuildRoleCreate, role);
    await f.fire(Events.GuildRoleDelete, role);
    await f.fire(Events.GuildRoleUpdate, role, role);
    await f.fire(Events.MessageDelete, message);
    await f.fire(Events.MessageBulkDelete, new Collection([['message', message]]), f.channel);
    await f.fire(Events.GuildBanAdd, { guild: f.guild, user: f.target.user, reason: 'Handmatige ban' });
    await f.fire(Events.GuildBanRemove, { guild: f.guild, user: f.target.user });
    await f.fire(Events.GuildUpdate, { ...f.guild, verificationLevel: 0, mfaLevel: 0 }, { ...f.guild, verificationLevel: 2, mfaLevel: 1 });
    const logs = f.records.filter(record => record.log).map(record => record.log);
    assert.equal(logs.length, 13);
    for (const category of ['members', 'roles', 'channelChanges', 'messages', 'moderation', 'system']) assert.ok(logs.some(row => row[1] === category));
    assert.ok(!JSON.stringify(logs.map(row => row.slice(1))).includes('Interne berichtinhoud'));
    assert.ok(logs.some(row => row[2] === 'Lid geband' && row[3].target === IDs.target && row[3].reason === 'Handmatige ban'));
    assert.ok(logs.some(row => row[2] === 'Lid unbanned'));
    assertNoAutomaticActions(f);
  } finally { f.store.close(); }
});

test('auditlogs bewaren actor en doelwit en dedupliceren zonder drempels of sancties', async () => {
  const f = eventFixture();
  try {
    const entry = { id: '123456789012345712', action: AuditLogEvent.MemberKick, executorId: IDs.actor, targetId: IDs.target, reason: 'Discord kick', createdTimestamp: Date.now() };
    await logAuditEntry(f.ctx, entry, f.guild);
    await logAuditEntry(f.ctx, entry, f.guild);
    for (let index = 0; index < 60; index++) await logAuditEntry(f.ctx, { ...entry, id: String(123456789012345800n + BigInt(index)), action: AuditLogEvent.RoleDelete, targetId: IDs.mod }, f.guild);
    const logs = f.records.filter(record => record.log).map(record => record.log);
    assert.equal(logs.length, 61);
    assert.equal(logs[0][1], 'moderation');
    assert.equal(logs[0][3].actor, IDs.actor);
    assert.equal(logs[0][3].target, IDs.target);
    assert.equal(logs[0][3].reason, 'Discord kick');
    assert.equal(logs[1][1], 'roles');
    assert.equal(logs[1][3].target, null);
    assert.match(logs[1][3].reason, new RegExp(IDs.mod));
    assert.equal(f.store.all('SELECT * FROM audit_seen').length, 61);
    assertNoAutomaticActions(f);
  } finally { f.store.close(); }
});

test('events uit andere guilds en onbekende auditacties veranderen niets', async () => {
  const f = eventFixture();
  try {
    const foreignGuild = { ...f.guild, id: '123456789012345999' };
    await f.fire(Events.GuildMemberAdd, { ...f.target, guild: foreignGuild });
    await f.fire(Events.WebhooksUpdate, { ...f.channel, guild: foreignGuild });
    await f.fire(Events.MessageDelete, { guild: foreignGuild, id: '123456789012345710' });
    await logAuditEntry(f.ctx, { id: '123456789012345712', action: AuditLogEvent.MemberKick }, foreignGuild);
    await logAuditEntry(f.ctx, { id: '123456789012345713', action: -1 }, f.guild);
    assert.equal(f.records.length, 0);
    assert.equal(f.store.all('SELECT * FROM audit_seen').length, 0);
    assertNoAutomaticActions(f);
  } finally { f.store.close(); }
});
