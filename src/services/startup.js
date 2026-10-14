import { registerGuildCommands } from './command-registration.js';
import { refreshApplicationEmojis } from '../utils/application-emojis.js';

export async function startReady(ctx, recovered = 0) {
  const { env, client, logger, scheduler } = ctx;
  const guild = await client.guilds.fetch(env.guildId);
  if (guild.id !== env.guildId) throw new Error('Discord heeft een andere server dan DISCORD_GUILD_ID teruggegeven.');
  if (client.application?.id !== env.clientId) throw new Error('Deze token hoort niet bij DISCORD_CLIENT_ID. Controleer de Application ID in het Developer Portal.');
  let registration;
  if (env.registerOnStart !== false) {
    const count = await registerGuildCommands(client.rest, client.application.id, env.guildId);
    registration = `${count} slash commands geregistreerd in guild ${env.guildId}.`;
    console.log(registration);
  } else {
    registration = 'Automatische slashcommandregistratie staat uit; gebruik npm run register na commandwijzigingen.';
    console.log(registration);
  }
  try {
    await refreshApplicationEmojis(ctx, guild);
  } catch (error) {
    await logger.error(guild, 'Applicatie-emoji ophalen mislukt', error);
  }
  await logger.log(guild, 'system', 'RLRP Main gestart', {
    result: `${client.user.tag}; ${recovered} onderbroken acties gemarkeerd voor controle. ${registration}`
  });
  console.log(`RLRP Main online in ${guild.name}.`);
  await scheduler.start();
  return guild;
}
