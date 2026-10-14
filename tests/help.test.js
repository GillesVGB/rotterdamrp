import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageFlags, PermissionsBitField } from 'discord.js';
import { commandKeys, builders } from '../src/commands/registry.js';
import { helpCategories } from '../src/commands/utility/definitions.js';
import { helpEntries, helpPages, renderEntry, accessLabel } from '../src/services/help.js';
import { interaction } from '../src/handlers/interactions.js';
import { fixture, IDs } from './fixture.js';

const lastReply = f => f.records.filter(record => record.reply).at(-1)?.reply;
const view = f => f.store.get('SELECT * FROM views WHERE command_key=?', 'help');
const chat = i => Object.assign(i, {
  isChatInputCommand: () => true, isButton: () => false,
  isAnySelectMenu: () => false, isModalSubmit: () => false
});
const component = (i, customId, values = null) => Object.assign(i, {
  customId, values, isChatInputCommand: () => false,
  isButton: () => values === null, isAnySelectMenu: () => values !== null,
  isModalSubmit: () => false
});

async function openHelp(f, category = null) {
  await f.ctx.help.execute(f.interaction('help', {categorie: category}), f.actor, f.store.config(IDs.guild));
  return view(f);
}

test('help bevat iedere geregistreerde commandroute precies één keer', () => {
  const f = fixture();
  try {
    const entries = helpEntries();
    assert.deepEqual(entries.map(entry => entry.key).sort(), commandKeys().sort());
    assert.equal(new Set(entries.map(entry => entry.key)).size, entries.length);
    assert.equal(entries.length, 47);
    assert.deepEqual(entries.filter(entry => entry.key.startsWith('giveaway.')).map(entry => entry.key).sort(), ['giveaway.reroll','giveaway.start','giveaway.stop']);
    assert.ok(!entries.some(entry => entry.key.startsWith('giveawaybeheer.')));
    assert.ok(entries.every(entry => !['setup', 'antinuke'].includes(entry.name)));
    const output = helpPages(f.c).join('\n');
    for (const entry of entries) assert.equal(output.split(`**${entry.command}**`).length - 1, 1, entry.key);
  } finally { f.store.close(); }
});

test('help-categorieën sluiten aan op de slashkeuzes en bevatten de juiste commands', () => {
  const f = fixture();
  try {
    const values = helpCategories.map(category => category.value);
    assert.equal(new Set(values).size, values.length);
    assert.ok(!values.includes('beveiliging'));
    const definition = builders().find(builder => builder.name === 'help').toJSON();
    assert.deepEqual(definition.options[0].choices.map(choice => choice.value), values);
    for (const entry of helpEntries()) assert.ok(values.includes(entry.helpCategory), entry.key);
    for (const category of helpCategories) {
      const output = helpPages(f.c, category.value).join('\n');
      for (const entry of helpEntries()) {
        const appears = output.includes(`**${entry.command}**`);
        assert.equal(appears, category.value === 'alle' || entry.helpCategory === category.value, `${category.value}: ${entry.key}`);
      }
    }
    assert.throws(() => helpPages(f.c, 'beveiliging'), /Onbekende helpcategorie/);
  } finally { f.store.close(); }
});

test('alle echte helppagina’s blijven binnen de Discord-embedlimieten', () => {
  const f = fixture();
  try {
    const emojiId = '1539529905417490462';
    f.guild.emojis.cache.set(emojiId, {name: 'rlogo', id: emojiId, toString: () => `<:rlogo:${emojiId}>`});
    for (const category of helpCategories) {
      const pages = helpPages(f.store.config(IDs.guild), category.value);
      const current = {id: 'help-limits', title: `Help • ${category.label}`, pages: JSON.stringify(pages)};
      for (let index = 0; index < pages.length; index++) {
        const reply = f.ctx.help.data(f.guild, current, index);
        const embed = reply.embeds[0];
        assert.ok(embed.description.length <= 4096);
        assert.ok(embed.title.length + embed.description.length + embed.footer.text.length <= 4096);
        assert.ok(embed.description.includes(pages[index].slice(-100)), `${category.value}: pagina ${index + 1} is volledig`);
        assert.match(embed.footer.text, new RegExp(`Pagina ${index + 1}/${pages.length}`));
        assert.ok(reply.components.length >= 1);
        assert.deepEqual(reply.allowedMentions.parse, []);
      }
    }
  } finally { f.store.close(); }
});

test('help toont native Discord-rolparameters en verplichte/optionele invoer', () => {
  const f = fixture();
  try {
    const entries = helpEntries();
    const hiring = renderEntry(entries.find(entry => entry.key === 'aannemen'), f.c);
    assert.match(hiring, /functie:<Discord-rol>/);
    assert.match(hiring, /`functie` \(verplicht, Discord-rol\)/);
    assert.match(hiring, /\[reden:<tekst>\]/);
    const update = renderEntry(entries.find(entry => entry.key === 'staffupdate'), f.c);
    assert.match(update, /nieuwe_rank:<Discord-rol>/);
    assert.match(update, /rank-up, rank-down/);
    const dismissal = renderEntry(entries.find(entry => entry.key === 'ontslag'), f.c);
    assert.ok(!dismissal.includes('rol_verwijderen'));
  } finally { f.store.close(); }
});

test('help benoemt Beheer en exact de benodigde moderatorpermissie', () => {
  const f = fixture();
  try {
    const entries = helpEntries();
    assert.equal(accessLabel(entries.find(entry => entry.key === 'aannemen'), f.c), 'Beheer, Administrator of servereigenaar.');
    assert.equal(accessLabel(entries.find(entry => entry.key === 'systeem.afhandelen'), f.c), 'Beheer, Administrator of servereigenaar.');
    assert.equal(accessLabel(entries.find(entry => entry.key === 'help'), f.c), 'Alle serverleden.');
    for (const [command, flag] of [['ban', 'BanMembers'], ['kick', 'KickMembers'], ['warn', 'ModerateMembers'], ['purge', 'ManageMessages'], ['lock', 'ManageChannels'], ['modlogs', 'ViewAuditLog']]) {
      const label = accessLabel(entries.find(entry => entry.key === command), f.c);
      assert.ok(label.includes(`(${flag})`), command);
      assert.match(label, /Beheer\/Administrator\/servereigenaar/);
      assert.doesNotMatch(label, /Ingestelde commandrol|geconfigureerde rol/);
    }
  } finally { f.store.close(); }
});

test('de volledige commandhandler opent help privé voor een gewoon lid', async () => {
  const f = fixture();
  try {
    f.actor.roles.cache.delete(IDs.manage);
    f.actor.permissions = new PermissionsBitField([]);
    let deferred;
    const i = chat(f.interaction('help'));
    i.deferReply = async data => { deferred = data; i.deferred = true; };
    await interaction(f.ctx, i);
    assert.equal(deferred.flags, MessageFlags.Ephemeral);
    assert.equal(view(f).user_id, IDs.actor);
    assert.equal(view(f).guild_id, IDs.guild);
    assert.equal(view(f).command_key, 'help');
    assert.match(lastReply(f).embeds[0].title, /Help/);
    assert.equal(f.store.all('SELECT * FROM outbox').length, 0);
    assert.equal(f.records.filter(record => record.send).length, 0);
  } finally { f.store.close(); }
});

test('help kan niet door een andere gebruiker of andere guild worden overgenomen', async () => {
  const f = fixture();
  try {
    const current = await openHelp(f);
    const initial = lastReply(f);
    await assert.rejects(f.ctx.help.handle(f.interaction('help', {}, null, IDs.target), current.id, 'page', '1'), /andere gebruiker/);
    const otherGuild = f.interaction('help');
    otherGuild.guildId = '999999999999999999';
    await assert.rejects(f.ctx.help.handle(otherGuild, current.id, 'page', '1'), /andere gebruiker/);
    assert.equal(lastReply(f), initial);
  } finally { f.store.close(); }
});

test('verlopen helppaneel weigert buttons en categorie-selecties', async () => {
  const f = fixture();
  try {
    const current = await openHelp(f);
    f.store.run('UPDATE views SET expires_at=? WHERE id=?', Date.now() - 1000, current.id);
    await assert.rejects(f.ctx.help.handle(f.interaction('help'), current.id, 'page', '1'), /verlopen/);
    const select = f.interaction('help');
    select.values = ['moderatie'];
    await assert.rejects(f.ctx.help.handle(select, current.id, 'category'), /verlopen/);
  } finally { f.store.close(); }
});

test('help-categoriekeuze en volgende/vorige pagina werken via de centrale handler', async () => {
  const f = fixture();
  try {
    const current = await openHelp(f);
    const first = lastReply(f);
    const nextId = first.components[1].components[1].custom_id;
    const next = component(f.interaction('help'), nextId);
    await interaction(f.ctx, next);
    assert.match(lastReply(f).embeds[0].footer.text, /Pagina 2\//);
    const previousId = lastReply(f).components[1].components[0].custom_id;
    await interaction(f.ctx, component(f.interaction('help'), previousId));
    assert.match(lastReply(f).embeds[0].footer.text, /Pagina 1\//);
    const categoryId = lastReply(f).components[0].components[0].custom_id;
    await interaction(f.ctx, component(f.interaction('help'), categoryId, ['moderatie']));
    assert.match(lastReply(f).embeds[0].title, /Moderatie/);
    assert.match(lastReply(f).embeds[0].description, /\*\*\/ban\*\*/);
    assert.doesNotMatch(lastReply(f).embeds[0].description, /\*\*\/aannemen\*\*/);
    assert.equal(view(f).title, 'Help • Moderatie');
    assert.deepEqual(JSON.parse(view(f).pages), helpPages(f.store.config(IDs.guild), 'moderatie'));
    const selected = lastReply(f).components[0].components[0].options.filter(option => option.default);
    assert.equal(selected.length, 1);
    assert.equal(selected[0].value, 'moderatie');
    assert.equal(view(f).id, current.id);
  } finally { f.store.close(); }
});

test('help weigert ongeldige pagina’s en vervalste categorieën zonder contentwijziging', async () => {
  const f = fixture();
  try {
    const current = await openHelp(f);
    const original = view(f).pages;
    const pages = JSON.parse(current.pages);
    for (const index of ['-1', String(pages.length), '0.5', 'NaN']) {
      await assert.rejects(f.ctx.help.handle(f.interaction('help'), current.id, 'page', index), /Ongeldige helppagina/);
    }
    const select = f.interaction('help');
    select.values = ['setup'];
    await assert.rejects(f.ctx.help.handle(select, current.id, 'category'), /Onbekende helpcategorie/);
    assert.equal(view(f).pages, original);
    await assert.rejects(f.ctx.help.handle(f.interaction('help'), current.id, 'delete'), /Onbekende helpactie/);
  } finally { f.store.close(); }
});
