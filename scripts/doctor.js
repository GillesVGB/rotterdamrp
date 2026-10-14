import { Events } from 'discord.js';
import { environment } from '../src/config.js';
import { createContext } from '../src/app.js';
import { redact } from '../src/services/logging.js';
const env=environment(),ctx=createContext(env);
ctx.client.once(Events.ClientReady,async()=>{
  try {const guild=await ctx.client.guilds.fetch(env.guildId); console.log(await ctx.setup.health(guild,ctx.store.config(guild.id)));}
  catch(e) {console.error(redact(e.message,env)); process.exitCode=1;}
  finally {ctx.client.destroy();ctx.store.close();}
});
try {await ctx.client.login(env.token);} catch(e) {console.error(redact(e.message,env));ctx.store.close();ctx.client.destroy();process.exitCode=1;}
