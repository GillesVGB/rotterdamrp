import test from 'node:test';
import assert from 'node:assert/strict';
import { GuildMemberRoleManager } from 'discord.js';
import { fixture, IDs } from './fixture.js';

// Gebruik de echte discord.js-manager: een scalar PUT/DELETE retourneert een clone
// en ververst de oorspronkelijke GuildMember-cache pas bij een later gatewayevent.
function apiFixture(initial = [IDs.support]) {
  const f = fixture(), remote = new Set(initial), api = [];
  const member = f.target;
  f.guild.roles.resolveId = value => typeof value === 'string' ? value : value?.id || null;
  member._roles = [...initial];
  member._clone = function () {
    const clone = { ...this, _roles: [...this._roles] };
    clone.roles = new GuildMemberRoleManager(clone);
    return clone;
  };
  member.edit = async function ({ roles }) {
    const ids = [...roles.values()].map(f.guild.roles.resolveId).filter(id => id !== IDs.guild);
    api.push({ method: 'PATCH', ids });
    remote.clear();
    for (const id of ids) remote.add(id);
    const clone = this._clone();
    clone._roles = [...ids];
    return clone;
  };
  member.roles = new GuildMemberRoleManager(member);
  f.ctx.client.rest = {
    async put(route) { const id = route.split('/').at(-1); api.push({ method: 'PUT', id }); remote.add(id); },
    async delete(route) { const id = route.split('/').at(-1); api.push({ method: 'DELETE', id }); remote.delete(id); }
  };
  const fetch = f.guild.members.fetch;
  f.guild.members.fetch = async input => {
    const result = await fetch(input);
    if (result.id === member.id && typeof input === 'object' && input.force) result._roles = [...remote];
    return result;
  };
  return { ...f, remote, api };
}

function seedStaff(f, roleId, rank) {
  f.store.run('INSERT INTO staff(guild_id,user_id,rank,status,updated_at,role_id) VALUES (?,?,?,?,?,?)', IDs.guild, IDs.target, rank, 'actief', Date.now(), roleId);
}

const execute = (f, command, roleId = null, type = null) => f.ctx.staff.execute(f.interaction(command, {
  gebruiker: f.target, reden: 'Echte Discord-rol-API regressie', ...(type ? { type } : {}),
  ...(roleId ? { [command === 'aannemen' ? 'functie' : 'nieuwe_rank']: f.roles.get(roleId) } : {})
}), f.actor, f.c);

for (const [name, command, initialRole, selectedRole, type] of [
  ['aannemen met oude rank', 'aannemen', IDs.support, IDs.mod, null],
  ['promotie', 'staffupdate', IDs.support, IDs.mod, 'rank-up'],
  ['demotie', 'staffupdate', IDs.mod, IDs.support, 'rank-down']
]) {
  test(`${name} behoudt de nieuwe rank bij een nog niet ververste Discord-cache`, async () => {
    const f = apiFixture([initialRole]);
    try {
      if (command === 'staffupdate') seedStaff(f, initialRole, initialRole === IDs.support ? 'Support' : 'Moderator');
      await execute(f, command, selectedRole, type);
      assert.equal(f.remote.has(selectedRole), true);
      assert.equal(f.remote.has(initialRole), false);
      assert.deepEqual(f.api, [{ method: 'PUT', id: selectedRole }, { method: 'DELETE', id: initialRole }]);
      // De nieuwe rol hoeft nog niet via de Gateway in de oorspronkelijke cache te staan.
      assert.equal(f.target.roles.cache.has(selectedRole), false);
      assert.equal(f.target.roles.cache.has(initialRole), true);
      assert.equal(f.store.get('SELECT role_id FROM staff').role_id, selectedRole);
      assert.equal(f.store.get('SELECT state FROM actions').state, 'completed');
    } finally { f.store.close(); }
  });
}

test('ontslag verwijdert meerdere staffrollen met losse DELETEs en behoudt overige rollen', async () => {
  const f = apiFixture([IDs.support, IDs.mod, '123456789012345710']);
  try {
    const community = f.role('123456789012345710', 4); f.roles.set(community.id, community);
    seedStaff(f, IDs.support, 'Support');
    await execute(f, 'ontslag');
    assert.deepEqual([...f.remote], [community.id]);
    assert.ok(f.api.every(call => call.method === 'DELETE'));
    assert.deepEqual(f.api.map(call => call.id).sort(), [IDs.support, IDs.mod].sort());
    assert.equal(f.store.get('SELECT status FROM staff').status, 'ontslagen');
  } finally { f.store.close(); }
});

test('onafhankelijke roltoevoeging tussen rank-PUT en oude-rank-DELETE blijft behouden', async () => {
  const f = apiFixture();
  try {
    const community = f.role('123456789012345710', 4); f.roles.set(community.id, community);
    const put = f.ctx.client.rest.put;
    f.ctx.client.rest.put = async route => { await put(route); f.remote.add(community.id); };
    seedStaff(f, IDs.support, 'Support');
    await execute(f, 'staffupdate', IDs.mod, 'rank-up');
    assert.equal(f.remote.has(IDs.mod), true);
    assert.equal(f.remote.has(community.id), true);
    assert.equal(f.remote.has(IDs.support), false);
    assert.equal(f.api.filter(call => call.method === 'PATCH').length, 0);
  } finally { f.store.close(); }
});

test('mislukte rank-PUT laat staffregistratie intact zonder promotiepublicatie', async () => {
  const f = apiFixture();
  try {
    seedStaff(f, IDs.support, 'Support');
    f.ctx.client.rest.put = async () => { throw new Error('Missing Permissions'); };
    await assert.rejects(execute(f, 'staffupdate', IDs.mod, 'rank-up'), /Missing Permissions/);
    assert.deepEqual([...f.remote], [IDs.support]);
    assert.equal(f.store.get('SELECT role_id FROM staff').role_id, IDs.support);
    assert.equal(f.store.all('SELECT * FROM staff_history').length, 0);
    assert.equal(f.store.all('SELECT * FROM outbox').length, 0);
    assert.equal(f.store.get('SELECT state FROM actions').state, 'uncertain');
    assert.equal(f.records.filter(record => record.reply).length, 0);
  } finally { f.store.close(); }
});

test('mislukte oude-rank-DELETE na echte PUT registreert een onderbroken actie', async () => {
  const f = apiFixture();
  try {
    seedStaff(f, IDs.support, 'Support');
    f.ctx.client.rest.delete = async () => { throw new Error('Discord unavailable'); };
    await assert.rejects(execute(f, 'staffupdate', IDs.mod, 'rank-up'), /Discord unavailable/);
    assert.equal(f.remote.has(IDs.mod), true);
    assert.equal(f.remote.has(IDs.support), true);
    assert.equal(f.store.get('SELECT role_id FROM staff').role_id, IDs.support);
    assert.equal(f.store.all('SELECT * FROM staff_history').length, 0);
    assert.equal(f.store.all('SELECT * FROM outbox').length, 0);
    assert.equal(f.store.get('SELECT state FROM actions').state, 'uncertain');
    assert.equal(f.records.filter(record => record.reply).length, 0);
  } finally { f.store.close(); }
});
