import { Routes } from 'discord.js';
import { builders } from '../commands/registry.js';
import { id } from '../utils/validation.js';

export async function registerGuildCommands(rest, clientId, guildId) {
  const application = id(clientId), guild = id(guildId);
  const commands = builders().map(builder => builder.toJSON());
  if (!commands.length) throw new Error('Slashcommandregistratie geweigerd: de commandlijst is leeg.');
  if (!rest || typeof rest.put !== 'function') throw new Error('Slashcommandregistratie vereist een ingelogde Discord REST-client.');
  let confirmed;
  try {
    confirmed = await rest.put(Routes.applicationGuildCommands(application, guild), { body: commands });
  } catch (error) {
    throw new Error(`Slashcommandregistratie mislukt: ${error.message}`, { cause: error });
  }
  const expected = new Set(commands.map(command => command.name));
  const received = new Set(Array.isArray(confirmed) ? confirmed.map(command => command?.name) : []);
  if (!Array.isArray(confirmed) || confirmed.length !== commands.length || received.size !== expected.size ||
      confirmed.some(command => !expected.has(command?.name) || (command.type ?? 1) !== 1 ||
        (command.application_id && command.application_id !== application) || (command.guild_id && command.guild_id !== guild))) {
    throw new Error('Discord heeft niet de volledige verwachte guildcommandlijst bevestigd. Controleer de registratie voordat je de bot gebruikt.');
  }
  return confirmed.length;
}
