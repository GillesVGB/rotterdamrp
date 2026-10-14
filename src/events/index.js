import { Events } from 'discord.js';
import { interaction } from '../handlers/interactions.js';
import { truncate } from '../utils/validation.js';
export function wireEvents(ctx) {
  const {client,logger,security,env,store}=ctx;
  const safe=(name,fn)=>client.on(name,(...args)=>{Promise.resolve().then(()=>fn(...args)).catch(e=>logger.error(args.find(x=>x?.guild)?.guild || args.find(x=>x?.id===env.guildId) || null,`Event ${name}`,e).catch(err=>console.error(err.message)));});
  const inGuild=g=>g?.id===env.guildId;
  safe(Events.InteractionCreate,i=>interaction(ctx,i));
  safe(Events.GuildAuditLogEntryCreate,(entry,guild)=>security.audit(entry,guild));
  safe(Events.GuildMemberAdd,async member=>{if(!inGuild(member.guild)) return; await logger.log(member.guild,'members','Lid toegetreden',{target:member.id,result:`Account aangemaakt op ${member.user.createdAt.toISOString()}`}); await security.join(member);});
  safe(Events.GuildMemberRemove,member=>inGuild(member.guild) && logger.log(member.guild,'members','Lid vertrokken',{target:member.id}));
  safe(Events.GuildMemberUpdate,async(old,current)=>{
    if(!inGuild(current.guild)) return;
    const added=current.roles.cache.filter(r=>!old.roles.cache.has(r.id)),removed=old.roles.cache.filter(r=>!current.roles.cache.has(r.id));
    if(added.size || removed.size) await logger.log(current.guild,'roles','Lidrollen gewijzigd',{target:current.id,reason:`Toegevoegd: ${[...added.keys()].join(', ') || '—'}; verwijderd: ${[...removed.keys()].join(', ') || '—'}`,result:'Uitvoerder niet uit dit event vast te stellen; zie auditlogs.'});
  });
  safe(Events.MessageCreate,message=>security.message(message));
  safe(Events.MessageDelete,async message=>{
    if(!inGuild(message.guild)) return;
    const c=store.config(message.guild.id);
    await logger.log(message.guild,'messages','Bericht verwijderd',{target:message.author?.id || null,reason:`Kanaal ${message.channelId}, bericht ${message.id}${c.logging.messageContent && message.content ? `; inhoud: ${truncate(message.content,600)}` : ''}`,result:'Uitvoerder onbekend; inhoud van uncached berichten niet beschikbaar.'});
  });
  safe(Events.MessageBulkDelete,(messages,channel)=>inGuild(channel.guild) && logger.log(channel.guild,'messages','Berichten in bulk verwijderd',{reason:`Kanaal ${channel.id}`,result:`${messages.size} berichten` }));
  safe(Events.MessageUpdate,async(old,current)=>{
    if(!inGuild(current.guild) || old.content===current.content || current.author?.id===client.user.id) return;
    const c=store.config(current.guild.id);
    await logger.log(current.guild,'messages','Bericht aangepast',{actor:current.author?.id || null,reason:`Kanaal ${current.channelId}, bericht ${current.id}${c.logging.messageContent ? `; oud: ${truncate(old.content,250)}; nieuw: ${truncate(current.content,250)}` : ''}`});
    await security.message(current);
  });
  for(const [event,rule,category,label] of [
    [Events.ChannelCreate,'channelCreate','channelChanges','Kanaal gemaakt'],[Events.ChannelDelete,'channelDelete','channelChanges','Kanaal verwijderd'],
    [Events.GuildRoleCreate,'roleCreate','roles','Rol gemaakt'],[Events.GuildRoleDelete,'roleDelete','roles','Rol verwijderd']
  ]) safe(event,async object=>{if(!inGuild(object.guild)) return; await logger.log(object.guild,category,label,{reason:`${object.name} (${object.id})`,result:'Event ontvangen; attributie via auditlogs.'}); await security.observed(object.guild,rule,object.id);});
  safe(Events.ChannelUpdate,async(old,current)=>{if(!inGuild(current.guild)) return; await logger.log(current.guild,'channelChanges','Kanaal gewijzigd',{reason:`${current.name} (${current.id})`}); await security.observed(current.guild,'channelUpdate',current.id);});
  safe(Events.GuildRoleUpdate,async(old,current)=>{if(!inGuild(current.guild)) return; await logger.log(current.guild,'roles','Rol gewijzigd',{reason:`${current.name} (${current.id}); permissies ${old.permissions.bitfield} ➜ ${current.permissions.bitfield}`}); await security.observed(current.guild,'roleUpdate',current.id);});
  safe(Events.GuildBanAdd,ban=>inGuild(ban.guild) && security.observed(ban.guild,'ban',ban.user.id));
  safe(Events.GuildUpdate,async(old,current)=>{if(!inGuild(current)) return; await logger.log(current,'security','Serverinstellingen gewijzigd',{reason:`Verificatieniveau ${old.verificationLevel} ➜ ${current.verificationLevel}; MFA ${old.mfaLevel} ➜ ${current.mfaLevel}`}); await security.observed(current,'guildUpdate',current.id);});
  safe(Events.WebhooksUpdate,async channel=>{
    if(!inGuild(channel.guild)) return;
    await logger.log(channel.guild,'security','Webhookwijziging waargenomen',{reason:`Kanaal ${channel.id}`});
    // Target is een webhook-ID, niet het kanaal-ID. De aparte auditloglistener attribueert de actie.
  });
  safe(Events.Error,error=>logger.error(client.guilds.cache.get(env.guildId),'Discord-clientfout',error));
  safe(Events.ShardError,error=>logger.error(client.guilds.cache.get(env.guildId),'Gatewayfout',error));
  safe(Events.Warn,message=>client.guilds.cache.get(env.guildId) ? logger.log(client.guilds.cache.get(env.guildId),'system','Discord-waarschuwing',{result:message}) : console.warn('Discord-waarschuwing ontvangen vóór guildverbinding.'));
}
