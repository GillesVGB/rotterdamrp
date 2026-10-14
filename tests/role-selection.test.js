import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationCommandOptionType } from 'discord.js';
import { builders } from '../src/commands/registry.js';
import { fixture, IDs } from './fixture.js';

const snapshot = f => ({
  roles: [...f.target.roles.cache.keys()].sort(),
  staff: f.store.all('SELECT * FROM staff'),
  history: f.store.all('SELECT * FROM staff_history'),
  actions: f.store.all('SELECT * FROM actions'),
  outbox: f.store.all('SELECT * FROM outbox'),
  records: f.records.length
});

function selection(f, command, roleId, extra = {}) {
  return f.interaction(command, {
    gebruiker: f.target,
    [command === 'aannemen' ? 'functie' : 'nieuwe_rank']: f.roles.get(roleId),
    ...(command === 'staffupdate' ? { type: 'rank-up' } : {}),
    reden: 'Geselecteerde Discord-rank',
    ...extra
  });
}

function seedStaff(f) {
  f.store.run('INSERT INTO staff(guild_id,user_id,rank,status,updated_at) VALUES (?,?,?,?,?)', IDs.guild, IDs.target, 'Support', 'actief', Date.now());
}

test('aannemen en staffupdate registreren verplichte native Discord-rolopties', () => {
  const registered = builders().map(builder => builder.toJSON());
  for (const [command, option] of [['aannemen', 'functie'], ['staffupdate', 'nieuwe_rank']]) {
    const field = registered.find(definition => definition.name === command).options.find(value => value.name === option);
    assert.equal(field.type, ApplicationCommandOptionType.Role);
    assert.equal(field.required, true);
    assert.equal(field.choices, undefined);
    assert.equal(field.max_length, undefined);
  }
});

test('aannemen koppelt geselecteerde rol-ID aan de ingestelde rank en voert echte rolwijzigingen uit', async () => {
  const f = fixture();
  try {
    // Discord-rolnamen mogen verschillen van de naam in de rankconfiguratie.
    f.roles.get(IDs.mod).name = 'Discord Moderator Team';
    await f.ctx.staff.execute(selection(f, 'aannemen', IDs.mod), f.actor, f.c);
    assert.equal(f.target.roles.cache.has(IDs.mod), true);
    assert.equal(f.target.roles.cache.has(IDs.support), false);
    assert.deepEqual(f.records.filter(record => record.add).map(record => record.add), [IDs.mod]);
    assert.equal(f.store.get('SELECT rank,status FROM staff').rank, 'Moderator');
    assert.equal(f.store.get('SELECT rank,status FROM staff').status, 'actief');
    const history = f.store.get('SELECT kind,new_rank FROM staff_history');
    assert.equal(history.kind, 'aannemen');
    assert.equal(history.new_rank, 'Moderator');
    assert.equal(f.store.get('SELECT state FROM actions').state, 'completed');
    const publication = JSON.parse(f.store.get('SELECT payload FROM outbox').payload);
    assert.match(publication.embeds[0].description, new RegExp(`<@&${IDs.mod}>`));
  } finally {
    f.store.close();
  }
});

for (const command of ['aannemen', 'staffupdate']) {
  for (const [caseName, prepare, expected] of [
    ['managed rol', f => { f.roles.get(IDs.mod).managed = true; return IDs.mod; }, /toewijsbaar/i],
    ['configuratiebeheerderrol', f => { f.ctx.env.ownerRoles = [IDs.mod]; return IDs.mod; }, /Ownerrollen/i]
  ]) {
    test(`${command} weigert geselecteerde ${caseName} zonder Discord- of databasemutaties`, async () => {
      const f = fixture();
      try {
        if (command === 'staffupdate') seedStaff(f);
        const roleId = prepare(f);
        const before = snapshot(f);
        await assert.rejects(f.ctx.staff.execute(selection(f, command, roleId), f.actor, f.c), expected);
        assert.deepEqual(snapshot(f), before);
      } finally {
        f.store.close();
      }
    });
  }
}

test('aannemen accepteert een veilige echte Discord-rol zonder vooraf ingestelde rank', async () => {
  const f = fixture();
  try {
    const role = f.role('123456789012345710', 30);
    role.name = 'Senior Helper';
    f.roles.set(role.id, role);
    const configuredRanks = structuredClone(f.c.roles.ranks);
    await f.ctx.staff.execute(selection(f, 'aannemen', role.id), f.actor, f.c);
    assert.equal(f.target.roles.cache.has(role.id), true);
    assert.equal(f.target.roles.cache.has(IDs.support), false);
    const staff = f.store.get('SELECT rank,role_id,status FROM staff');
    assert.equal(staff.rank, role.name);
    assert.equal(staff.role_id, role.id);
    assert.equal(staff.status, 'actief');
    assert.equal(f.store.get('SELECT new_rank FROM staff_history').new_rank, role.name);
    assert.deepEqual(f.c.roles.ranks, configuredRanks);
    assert.deepEqual(f.store.config(IDs.guild).roles.ranks, configuredRanks);
  } finally {
    f.store.close();
  }
});

test('staffupdate gebruikt Discord-rolpositie en verwijdert de vorige niet-ingestelde rankrol', async () => {
  const f = fixture();
  try {
    const role = f.role('123456789012345710', 30);
    role.name = 'Senior Helper';
    f.roles.set(role.id, role);
    await f.ctx.staff.execute(selection(f, 'aannemen', role.id), f.actor, f.c);
    await f.ctx.staff.execute(selection(f, 'staffupdate', IDs.mod, { type: 'rank-down' }), f.actor, f.c);
    assert.equal(f.target.roles.cache.has(role.id), false);
    assert.equal(f.target.roles.cache.has(IDs.mod), true);
    assert.equal(f.store.get('SELECT role_id FROM staff').role_id, IDs.mod);
    const history = f.store.get("SELECT old_rank,new_rank FROM staff_history WHERE kind='rank-down'");
    assert.equal(history.old_rank, role.name);
    assert.equal(history.new_rank, 'Moderator');
  } finally {
    f.store.close();
  }
});

test('ontslag verwijdert de opgeslagen niet-ingestelde staffrol', async () => {
  const f = fixture();
  try {
    const role = f.role('123456789012345710', 30);
    role.name = 'Senior Helper';
    f.roles.set(role.id, role);
    await f.ctx.staff.execute(selection(f, 'aannemen', role.id), f.actor, f.c);
    await f.ctx.staff.execute(f.interaction('ontslag', { gebruiker: f.target, reden: 'Uit dienst' }), f.actor, f.c);
    assert.equal(f.target.roles.cache.has(role.id), false);
    assert.equal(f.store.get('SELECT status FROM staff').status, 'ontslagen');
    assert.equal(f.store.get("SELECT old_rank FROM staff_history WHERE kind='ontslag'").old_rank, role.name);
  } finally {
    f.store.close();
  }
});

test('rolselectie behoudt promotie, demotie en de oude/nieuwe geconfigureerde ranks', async () => {
  const f = fixture();
  try {
    await f.ctx.staff.execute(selection(f, 'aannemen', IDs.support), f.actor, f.c);
    await f.ctx.staff.execute(selection(f, 'staffupdate', IDs.mod, { type: 'rank-up' }), f.actor, f.c);
    assert.equal(f.target.roles.cache.has(IDs.mod), true);
    assert.equal(f.target.roles.cache.has(IDs.support), false);
    await f.ctx.staff.execute(selection(f, 'staffupdate', IDs.support, { type: 'rank-down' }), f.actor, f.c);
    assert.equal(f.target.roles.cache.has(IDs.support), true);
    assert.equal(f.target.roles.cache.has(IDs.mod), false);
    assert.equal(f.store.get('SELECT rank FROM staff').rank, 'Support');
    assert.deepEqual(f.store.all("SELECT kind,old_rank,new_rank FROM staff_history WHERE kind IN ('rank-up','rank-down') ORDER BY id").map(row => ({ ...row })), [
      { kind: 'rank-up', old_rank: 'Support', new_rank: 'Moderator' },
      { kind: 'rank-down', old_rank: 'Moderator', new_rank: 'Support' }
    ]);
  } finally {
    f.store.close();
  }
});

for (const [type, roleId] of [['rank-up', IDs.support], ['rank-down', IDs.mod]]) {
  test(`rolselectie weigert ${type} naar een rank die niet bij de richting past`, async () => {
    const f = fixture();
    try {
      seedStaff(f);
      const before = snapshot(f);
      await assert.rejects(f.ctx.staff.execute(selection(f, 'staffupdate', roleId, { type }), f.actor, f.c), /richting/i);
      assert.deepEqual(snapshot(f), before);
    } finally {
      f.store.close();
    }
  });
}
