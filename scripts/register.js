import { REST,Routes } from 'discord.js';
import { environment } from '../src/config.js';
import { builders } from '../src/commands/registry.js';
import { redact } from '../src/services/logging.js';
const env=environment();
try {
  const commands=builders().map(b=>b.toJSON()),rest=new REST({version:'10'}).setToken(env.token);
  await rest.put(Routes.applicationGuildCommands(env.clientId,env.guildId),{body:commands});
  console.log(`${commands.length} slash commands geregistreerd in guild ${env.guildId}.`);
} catch(e) { console.error(redact(e.message,env)); process.exitCode=1; }
