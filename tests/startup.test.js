import test from 'node:test';
import assert from 'node:assert/strict';
import { Collection, Routes } from 'discord.js';
import { registerGuildCommands } from '../src/services/command-registration.js';
import { startReady } from '../src/services/startup.js';
import { builders } from '../src/commands/registry.js';
import { environment } from '../src/config.js';
import { redact } from '../src/services/logging.js';

const applicationId = '123456789012345678', guildId = '123456789012345679', ownerId = '123456789012345680';
const confirmation = body => body.map(command => ({
  name: command.name, type: 1, application_id: applicationId, guild_id: guildId
}));

function startupFixture(t) {
  const calls = [], consoleLines = [], guild = { id: guildId, name: 'Startup Testguild', emojis: { cache: new Collection() } };
  t.mock.method(console, 'log', (...args) => consoleLines.push(args.join(' ')));
  const emojiCache = new Collection(['rlogo', 'upvote', 'downvote'].map((name, index) => [String(index), { id: String(index), name, available: true }]));
  const ctx = {
    env: { clientId: applicationId, guildId, token: 'startup-secret' },
    client: {
      user: { tag: 'RLRP#0001' },
      application: { id: applicationId, emojis: { cache: emojiCache, async fetch() { calls.push({ kind: 'emojis' }); return emojiCache; } } },
      guilds: { async fetch(id) { calls.push({ kind: 'guild', id }); return guild; } },
      rest: { async put(route, { body }) { calls.push({ kind: 'put', route, body }); return confirmation(body); } }
    },
    store: { config: () => ({ brand: { logoEmojiId: null, upvoteEmojiId: null, downvoteEmojiId: null } }) },
    logger: {
      async log(...args) { calls.push({ kind: 'log', args }); },
      async error(...args) { calls.push({ kind: 'error', args }); }
    },
    scheduler: { async start() { calls.push({ kind: 'scheduler' }); } }
  };
  guild.client = ctx.client;
  return { ctx, guild, calls, consoleLines };
}

test('environment schakelt startupregistratie standaard in en leest expliciete booleans', () => {
  const input = { DISCORD_TOKEN: 'test-secret', DISCORD_CLIENT_ID: applicationId, DISCORD_GUILD_ID: guildId, BOT_OWNER_IDS: ownerId };
  assert.equal(environment(input).registerOnStart, true);
  assert.equal(environment({ ...input, REGISTER_COMMANDS_ON_START: 'true' }).registerOnStart, true);
  assert.equal(environment({ ...input, REGISTER_COMMANDS_ON_START: 'false' }).registerOnStart, false);
  assert.throws(() => environment({ ...input, REGISTER_COMMANDS_ON_START: 'not-a-boolean' }), /REGISTER_COMMANDS_ON_START/);
});

test('startup registreert de volledige actuele guildcommandlijst voordat de scheduler start', async t => {
  const f = startupFixture(t);
  assert.equal(await startReady(f.ctx, 3), f.guild);
  assert.deepEqual(f.calls.map(call => call.kind), ['guild', 'put', 'emojis', 'log', 'scheduler']);
  const request = f.calls.find(call => call.kind === 'put');
  assert.equal(request.route, Routes.applicationGuildCommands(applicationId, guildId));
  assert.deepEqual(request.body, builders().map(builder => builder.toJSON()));
  assert.ok(request.body.some(command => command.name === 'help'));
  assert.ok(!request.body.some(command => command.name === 'antinuke'));
  assert.equal(request.body.find(command => command.name === 'aannemen').options.find(option => option.name === 'functie').type, 8);
  assert.match(f.consoleLines[0], new RegExp(`${request.body.length} slash commands geregistreerd`));
  assert.match(f.calls.find(call => call.kind === 'log').args[3].result, /3 onderbroken acties/);
});

test('startup opt-out behoudt emojiladen, gewone opstartlogging en scheduler', async t => {
  const f = startupFixture(t);
  f.ctx.env.registerOnStart = false;
  delete f.ctx.client.rest;
  await startReady(f.ctx);
  assert.deepEqual(f.calls.map(call => call.kind), ['guild', 'emojis', 'log', 'scheduler']);
  assert.match(f.consoleLines[0], /staat uit/);
});

for (const variant of ['wrong-application', 'missing-application']) {
  test(`startup weigert ${variant} vóór registratie of scheduler`, async t => {
    const f = startupFixture(t);
    if (variant === 'missing-application') delete f.ctx.client.application;
    else f.ctx.client.application.id = ownerId;
    await assert.rejects(startReady(f.ctx), /DISCORD_CLIENT_ID/);
    assert.deepEqual(f.calls.map(call => call.kind), ['guild']);
    assert.equal(f.consoleLines.length, 0);
  });
}

test('startup guildfout voert geen commandmutaties of schedulerstart uit', async t => {
  const f = startupFixture(t);
  f.ctx.client.guilds.fetch = async () => { throw new Error('Missing Access'); };
  await assert.rejects(startReady(f.ctx), /Missing Access/);
  assert.equal(f.calls.length, 0);
  assert.equal(f.consoleLines.length, 0);
});

test('startup weigert een onverwachte guild vóór commandregistratie', async t => {
  const f = startupFixture(t);
  f.guild.id = ownerId;
  await assert.rejects(startReady(f.ctx), /DISCORD_GUILD_ID/);
  assert.deepEqual(f.calls.map(call => call.kind), ['guild']);
});

test('registratiefout houdt startup tegen en produceert geen succesmelding of secretlog', async t => {
  const f = startupFixture(t), error = Object.assign(new Error(`Missing Access ${f.ctx.env.token}`), { code: 50001 });
  f.ctx.client.rest.put = async () => { f.calls.push({ kind: 'put' }); throw error; };
  await assert.rejects(startReady(f.ctx), value => {
    assert.equal(value.cause, error);
    assert.match(value.message, /Slashcommandregistratie mislukt/);
    const safeMessage = redact(value.message, f.ctx.env);
    assert.ok(!safeMessage.includes(f.ctx.env.token));
    assert.match(safeMessage, /\[secret\]/);
    return true;
  });
  assert.deepEqual(f.calls.map(call => call.kind), ['guild', 'put']);
  assert.equal(f.consoleLines.length, 0);
});

test('emoji API-fout wordt gelogd en blokkeert bevestigde registratie of scheduler niet', async t => {
  const f = startupFixture(t);
  f.ctx.client.application.emojis.fetch = async () => { f.calls.push({ kind: 'emojis' }); throw new Error('Emoji API unavailable'); };
  await startReady(f.ctx);
  assert.deepEqual(f.calls.map(call => call.kind), ['guild', 'put', 'emojis', 'error', 'log', 'scheduler']);
  assert.equal(f.calls.find(call => call.kind === 'error').args[1], 'Applicatie-emoji ophalen mislukt');
});

test('onvolledige Discord-bevestiging blokkeert startup zonder succesmelding', async t => {
  const f = startupFixture(t);
  f.ctx.client.rest.put = async () => { f.calls.push({ kind: 'put' }); return []; };
  await assert.rejects(startReady(f.ctx), /niet de volledige verwachte guildcommandlijst bevestigd/);
  assert.deepEqual(f.calls.map(call => call.kind), ['guild', 'put']);
  assert.equal(f.consoleLines.length, 0);
});

test('handmatige registratie gebruikt dezelfde helper en controleert bevestiging zonder gatewaylogin', async () => {
  let request;
  const count = await registerGuildCommands({ async put(route, { body }) { request = { route, body }; return confirmation(body).reverse(); } }, applicationId, guildId);
  assert.equal(count, builders().length);
  assert.equal(request.route, Routes.applicationGuildCommands(applicationId, guildId));
});

for (const [name, transform] of [
  ['geen array', () => ({ ok: true })],
  ['lege lijst', () => []],
  ['ontbrekend command', commands => commands.slice(1)],
  ['onverwachte naam', commands => commands.map((command, index) => index === 0 ? { ...command, name: 'niet-geregistreerd' } : command)],
  ['dubbele naam', commands => commands.map((command, index) => index === 0 ? { ...command, name: commands[1].name } : command)],
  ['verkeerd commandtype', commands => commands.map((command, index) => index === 0 ? { ...command, type: 2 } : command)],
  ['andere application', commands => commands.map(command => ({ ...command, application_id: ownerId }))],
  ['andere guild', commands => commands.map(command => ({ ...command, guild_id: ownerId }))]
]) {
  test(`registratie claimt geen succes bij bevestiging met ${name}`, async () => {
    const rest = { async put(route, { body }) { return transform(confirmation(body)); } };
    await assert.rejects(registerGuildCommands(rest, applicationId, guildId), /niet de volledige verwachte guildcommandlijst bevestigd/);
  });
}

test('ongeldige application- of guild-ID leidt tot nul REST-mutaties', async () => {
  let requests = 0;
  const rest = { async put() { requests++; } };
  await assert.rejects(registerGuildCommands(rest, 'invalid', guildId), /Discord-ID/);
  await assert.rejects(registerGuildCommands(rest, applicationId, 'invalid'), /Discord-ID/);
  assert.equal(requests, 0);
});
