import { brandEmoji } from './embeds.js';
export async function refreshApplicationEmojis(ctx,guild) {
  const manager=ctx.client.application?.emojis;
  if(!manager) throw new Error('ClientApplication emoji-manager ontbreekt.');
  const current=await manager.fetch();
  for(const key of manager.cache.keys()) if(!current.has(key)) manager.cache.delete(key);
  const c=ctx.store.config(guild.id),missing=['rlogo','upvote','downvote'].filter(name=>!brandEmoji(guild,c,name));
  if(missing.length) await ctx.logger.log(guild,'system','Huisstijlemoji niet gevonden',{reason:missing.join(', '),result:'Controleer de application-emoji of configureer een bereikbaar guildemoji-ID; fallback blijft zichtbaar.'});
}
