import { REST } from 'discord.js';
import { environment } from '../src/config.js';
import { registerGuildCommands } from '../src/services/command-registration.js';
import { redact } from '../src/services/logging.js';
const env=environment();
try {
  const rest=new REST({version:'10'}).setToken(env.token);
  const count=await registerGuildCommands(rest,env.clientId,env.guildId);
  console.log(`${count} slash commands geregistreerd in guild ${env.guildId}.`);
} catch(e) { console.error(redact(e.message,env)); process.exitCode=1; }
