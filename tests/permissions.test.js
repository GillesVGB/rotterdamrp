import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionsBitField, PermissionFlagsBits as P } from 'discord.js';
import { authorize, isManagement, hierarchy, grantable, writable, botPermissions } from '../src/security/permissions.js';
import { policy, commandKeys } from '../src/commands/registry.js';
import { fixture, IDs } from './fixture.js';

const noManagement = f => {
  f.actor.roles.cache.delete(IDs.manage);
  f.actor.permissions = new PermissionsBitField([]);
};
const routePolicy = key => {
  const [root, sub] = key.split('.');
  return policy(root, sub || null);
};
const moderationRights = [
  ['ban', P.BanMembers], ['unban', P.BanMembers], ['kick', P.KickMembers],
  ['warn', P.ModerateMembers], ['warnings', P.ModerateMembers],
  ['timeout', P.ModerateMembers], ['untimeout', P.ModerateMembers],
  ['clearwarnings', P.ModerateMembers], ['purge', P.ManageMessages],
  ['lock', P.ManageChannels], ['unlock', P.ManageChannels], ['modlogs', P.ViewAuditLog]
];

for (const [command, permission] of moderationRights) {
  test(`${command}: eigen Discord-permissie geeft toegang zonder ingestelde staffrol`, async () => {
    const f = fixture();
    try {
      noManagement(f);
      f.actor.permissions = new PermissionsBitField([permission]);
      const result = await authorize(f.interaction(command), f.ctx, policy(command), command);
      assert.equal(result.member.id, IDs.actor);
    } finally { f.store.close(); }
  });
  test(`${command}: een andere Discord-permissie geeft geen toegang`, async () => {
    const f = fixture();
    try {
      noManagement(f);
      f.actor.permissions = new PermissionsBitField([P.ViewChannel]);
      await assert.rejects(authorize(f.interaction(command), f.ctx, policy(command), command), /Discord-permissie/);
      assert.equal(f.records.length, 0);
    } finally { f.store.close(); }
  });
}

test('Beheer zonder individuele Discord-permissies heeft toegang tot iedere commandroute', async () => {
  const f = fixture();
  try {
    f.actor.permissions = new PermissionsBitField([]);
    const keys = commandKeys();
    assert.ok(keys.includes('systeem.afhandelen'));
    assert.ok(keys.includes('staffwaarschuwing.geven'));
    assert.ok(keys.includes('help'));
    for (const key of keys) {
      const [root, sub] = key.split('.');
      await authorize(f.interaction(root, {}, sub), f.ctx, routePolicy(key), key);
    }
    assert.equal(f.records.length, 0);
  } finally { f.store.close(); }
});

test('Administrator zonder Beheerrol heeft toegang tot alle commandroutes', async () => {
  const f = fixture();
  try {
    f.actor.roles.cache.delete(IDs.manage);
    f.actor.permissions = new PermissionsBitField([P.Administrator]);
    for (const key of commandKeys()) {
      const [root, sub] = key.split('.');
      await authorize(f.interaction(root, {}, sub), f.ctx, routePolicy(key), key);
    }
  } finally { f.store.close(); }
});

test('een gewone moderator krijgt geen staff- of systeembeheer', async () => {
  const f = fixture();
  try {
    noManagement(f);
    f.actor.roles.cache.set(IDs.mod, f.roles.get(IDs.mod));
    f.actor.permissions = new PermissionsBitField([P.ManageRoles, P.ManageMessages, P.BanMembers, P.ViewAuditLog]);
    for (const key of ['aannemen', 'staffoverzicht', 'say', 'giveawaybeheer.opnieuw', 'systeem.status']) {
      const [root, sub] = key.split('.');
      await assert.rejects(authorize(f.interaction(root, {}, sub), f.ctx, routePolicy(key), key), /Beheer|Administrator/);
    }
  } finally { f.store.close(); }
});

test('verlies van Beheerrol trekt beheertoegang onmiddellijk in', async () => {
  const f = fixture();
  try {
    f.actor.permissions = new PermissionsBitField([]);
    await authorize(f.interaction('systeem', {}, 'status'), f.ctx, policy('systeem', 'status'), 'systeem.status');
    f.actor.roles.cache.delete(IDs.manage);
    await assert.rejects(authorize(f.interaction('systeem', {}, 'status'), f.ctx, policy('systeem', 'status'), 'systeem.status'), /Beheer|Administrator/);
    await assert.rejects(authorize(f.interaction('ban'), f.ctx, policy('ban'), 'ban'), /Discord-permissie/);
  } finally { f.store.close(); }
});

for (const key of ['managementRoles', 'ownerRoles']) {
  test(`${key}: environmentrol geeft Beheer zonder individuele rechten`, async () => {
    const f = fixture();
    try {
      f.ctx.env[key] = [IDs.support];
      assert.equal(isManagement(f.target, f.store.config(IDs.guild), f.ctx.env), true);
      await authorize(f.interaction('systeem', {}, 'status', IDs.target), f.ctx, policy('systeem', 'status'), 'systeem.status');
      f.target.roles.cache.delete(IDs.support);
      await assert.rejects(authorize(f.interaction('systeem', {}, 'status', IDs.target), f.ctx, policy('systeem', 'status'), 'systeem.status'), /Beheer|Administrator/);
    } finally { f.store.close(); }
  });
}

test('guildeigenaar heeft beheertoegang zonder aanvullende rollen of rechten', async () => {
  const f = fixture();
  try {
    f.owner.roles.cache.delete(IDs.manage);
    f.owner.permissions = new PermissionsBitField([]);
    await authorize(f.interaction('systeem', {}, 'status', IDs.owner), f.ctx, policy('systeem', 'status'), 'systeem.status');
  } finally { f.store.close(); }
});

test('publieke help is toegankelijk voor een gewoon serverlid', async () => {
  const f = fixture();
  try {
    noManagement(f);
    await authorize(f.interaction('help'), f.ctx, policy('help'), 'help');
  } finally { f.store.close(); }
});

test('guildgrens en DM-grens worden server-side afgedwongen', async () => {
  const f = fixture();
  try {
    const otherGuild = f.interaction('help');
    otherGuild.guildId = '999999999999999999';
    await assert.rejects(authorize(otherGuild, f.ctx, policy('help'), 'help'), /ingestelde server/);
    const dm = f.interaction('help');
    dm.inGuild = () => false;
    await assert.rejects(authorize(dm, f.ctx, policy('help'), 'help'), /ingestelde server/);
  } finally { f.store.close(); }
});

for (const [name, setup] of [
  ['zelf', f => { f.target = f.actor; }],
  ['guildeigenaar', f => { f.target = f.owner; }],
  ['bot', f => { f.target = f.bot; }],
  ['ander botaccount', f => { f.target.user.bot = true; }],
  ['beschermde rol', f => f.target.roles.cache.set(IDs.protect, f.roles.get(IDs.protect))],
  ['Beheerrol', f => f.target.roles.cache.set(IDs.manage, f.roles.get(IDs.manage))],
  ['gelijke rank', f => { f.target.roles.highest = f.actor.roles.highest; }],
  ['boven bot', f => { f.target.roles.highest = f.role('123456789012345690', 100); }]
]) test(`rolhiërarchie blokkeert ${name} ook voor Beheer`, () => {
  const f = fixture();
  try {
    setup(f);
    assert.throws(() => hierarchy(f.actor, f.target, f.bot, f.c, f.ctx.env));
    assert.equal(f.records.length, 0);
  } finally { f.store.close(); }
});

test('Beheer kan de botrechten niet vervangen', async () => {
  const f = fixture();
  try {
    f.bot.permissions = new PermissionsBitField([]);
    await authorize(f.interaction('ban'), f.ctx, policy('ban'), 'ban');
    await assert.rejects(botPermissions(f.guild, [P.BanMembers]), /bot mist/);
  } finally { f.store.close(); }
});

for (const key of ['managementRoles', 'ownerRoles']) test(`${key} beschermt tegen moderatie`, () => {
  const f = fixture();
  try {
    assert.throws(() => hierarchy(f.actor, f.target, f.bot, f.c, {[key]: [IDs.support]}), /beschermd/);
  } finally { f.store.close(); }
});

for (const [name, makeRole] of [
  ['gelijke botrol', f => f.roles.get(IDs.botRole)],
  ['boven de botrol', f => f.role('123456789012345690', 100)],
  ['gelijke actorrol', f => f.role('123456789012345690', 80)],
  ['boven de actorrol', f => f.role('123456789012345690', 85)],
  ['managed rol', f => ({...f.roles.get(IDs.support), managed: true})],
  ['everyone', f => f.guild.roles.everyone]
]) test(`Beheer kan ${name} niet toekennen`, () => {
  const f = fixture();
  try { assert.throws(() => grantable(f.actor, makeRole(f), f.bot, true)); }
  finally { f.store.close(); }
});

test('Beheer mag een lagere rol geven zonder individuele commandpermissies', () => {
  const f = fixture();
  try {
    f.actor.permissions = new PermissionsBitField([]);
    const rank = f.role('123456789012345690', 10, [P.ManageMessages]);
    assert.throws(() => grantable(f.actor, rank, f.bot), /rechten/);
    assert.doesNotThrow(() => grantable(f.actor, rank, f.bot, true));
  } finally { f.store.close(); }
});

test('staffwaarschuwingen mogen niet naar een publiek kanaal', async () => {
  const f = fixture();
  try { await assert.rejects(writable(f.guild, IDs.channel, {privateStaff: true, c: f.c}), /everyone/); }
  finally { f.store.close(); }
});

test('privé staffwaarschuwingkanaal accepteert Beheer-overwrite', async () => {
  const f = fixture();
  try {
    f.channel.permissionsFor = object => object.id === IDs.guild ? new PermissionsBitField([]) : new PermissionsBitField([P.Administrator]);
    f.channel.permissionOverwrites.cache.set(IDs.manage, {id: IDs.manage, allow: new PermissionsBitField([P.ViewChannel])});
    assert.equal(await writable(f.guild, IDs.channel, {privateStaff: true, c: f.c}), f.channel);
  } finally { f.store.close(); }
});

test('privé staffwaarschuwingkanaal weigert toegang voor een gewoon lid', async () => {
  const f = fixture();
  try {
    f.channel.permissionsFor = object => object.id === IDs.guild ? new PermissionsBitField([]) : new PermissionsBitField([P.Administrator]);
    f.channel.permissionOverwrites.cache.set(IDs.target, {id: IDs.target, allow: new PermissionsBitField([P.ViewChannel])});
    await assert.rejects(writable(f.guild, IDs.channel, {privateStaff: true, c: f.c}), /niet-management/);
  } finally { f.store.close(); }
});

test('privé staffwaarschuwingkanaal accepteert een uitsluitend via env ingestelde Beheerrol', async () => {
  const f = fixture();
  try {
    f.c.roles.management = [];
    f.ctx.env.managementRoles = [IDs.mod];
    f.actor.roles.cache.delete(IDs.manage);
    f.actor.roles.cache.set(IDs.mod, f.roles.get(IDs.mod));
    f.actor.permissions = new PermissionsBitField([]);
    f.store.saveConfig(IDs.guild, f.c, 1);
    await authorize(f.interaction('systeem', {}, 'status'), f.ctx, policy('systeem', 'status'), 'systeem.status');
    f.channel.permissionsFor = object => object.id === IDs.guild ? new PermissionsBitField([]) : new PermissionsBitField([P.Administrator]);
    f.channel.permissionOverwrites.cache.set(IDs.mod, {id: IDs.mod, allow: new PermissionsBitField([P.ViewChannel])});
    assert.equal(await writable(f.guild, IDs.channel, {privateStaff: true, c: f.c, env: f.ctx.env}), f.channel);
  } finally { f.store.close(); }
});
