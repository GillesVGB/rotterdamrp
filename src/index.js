import { Events } from 'discord.js';
import { environment } from './config.js';
import { createContext,attach } from './app.js';
import { redact } from './services/logging.js';
import { refreshApplicationEmojis } from './utils/application-emojis.js';
const env=environment(),ctx=attach(createContext(env));
const recovered=ctx.store.recover();
ctx.client.once(Events.ClientReady,async()=>{
  try {
    const guild=await ctx.client.guilds.fetch(env.guildId);
    if(ctx.client.application.id!==env.clientId) throw new Error('Deze token hoort niet bij DISCORD_CLIENT_ID.');
    try {await refreshApplicationEmojis(ctx,guild);} catch(e) {await ctx.logger.error(guild,'Applicatie-emoji ophalen mislukt',e);}
    await ctx.logger.log(guild,'system','RLRP Main gestart',{result:`${ctx.client.user.tag}; ${recovered} onderbroken acties gemarkeerd voor controle.`});
    console.log(`RLRP Main online in ${guild.name}.`); await ctx.scheduler.start();
  } catch(e) { console.error(redact(e.message,env)); await shutdown(1); }
});
let shutting=false;
async function shutdown(code=0) {
  if(shutting) return; shutting=true;
  const watchdog=setTimeout(()=>process.exit(1),15000); watchdog.unref();
  try { await ctx.scheduler.stop(); ctx.client.destroy(); ctx.store.close(); }
  finally { clearTimeout(watchdog); process.exit(code); }
}
process.on('SIGINT',()=>void shutdown()); process.on('SIGTERM',()=>void shutdown());
process.on('unhandledRejection',error=>{console.error(`Onverwachte promise-fout: ${redact(error?.message,env)}`); void shutdown(1);});
process.on('uncaughtException',error=>{console.error(`Fatale fout: ${redact(error.message,env)}`); void shutdown(1);});
try { await ctx.client.login(env.token); } catch(e) { console.error(`Login mislukt: ${redact(e.message,env)}`); await shutdown(1); }
