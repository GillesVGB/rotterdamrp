import { PermissionFlagsBits as P } from 'discord.js';
import { randomUUID } from 'node:crypto';
import { botPermissions, hierarchy,isManagement } from '../security/permissions.js';
import { UserError, id, duration, text } from '../utils/validation.js';
import { payload } from '../utils/embeds.js';
import { mutate, dm } from './logging.js';
import { showView } from './views.js';
export class ModerationService {
  constructor(ctx) { this.ctx = ctx; }
  sanction(i,user,kind,reason,expires=null,token=null,state='applied') {
    return Number(this.ctx.store.run('INSERT INTO sanctions(guild_id,user_id,actor,kind,reason,created_at,expires_at,token,state) VALUES (?,?,?,?,?,?,?,?,?)',i.guildId,user,i.user.id,kind,reason,Date.now(),expires,token,state).lastInsertRowid);
  }
  async execute(i,actor,c) {
    const { store,logger } = this.ctx, name = i.commandName, user = i.options.getUser('gebruiker');
    if (['warnings','modlogs'].includes(name)) {
      const rows = store.all(`SELECT * FROM sanctions WHERE guild_id=? AND user_id=? ${name === 'warnings' ? "AND kind='warn'" : ''} ORDER BY id DESC`,i.guildId,user.id);
      return showView(this.ctx,i,name === 'warnings' ? 'Waarschuwingen' : 'Moderatiehistorie',rows.map(r=>`#${r.id} • ${r.kind} • <t:${Math.floor(r.created_at/1000)}:f>\nDoor <@${r.actor}> • ${r.active ? 'actief' : 'afgesloten'} • ${r.state}\n${r.reason}${r.expires_at ? `\nVervalt <t:${Math.floor(r.expires_at/1000)}:R>` : ''}`).join('\n\n'),name);
    }
    if (name === 'purge') {
      const channel = i.channel, me = await botPermissions(i.guild,[P.ManageMessages]);
      if (!channel?.bulkDelete || !channel.permissionsFor(me).has([P.ViewChannel,P.ManageMessages,P.ReadMessageHistory]) || (!isManagement(actor,c,this.ctx.env) && !channel.permissionsFor(actor).has(P.ManageMessages))) throw new UserError('Je kunt hier geen berichten verwijderen.');
      const count = i.options.getInteger('aantal');
      const messages = await channel.messages.fetch({limit:count});
      const recent = messages.filter(m=>m.createdTimestamp > Date.now()-14*86400000+60000);
      if (!recent.size) throw new UserError('Er zijn geen verwijderbare berichten jonger dan 14 dagen.');
      const removed = await mutate(this.ctx,i,'purge',null,{channel:channel.id,count:recent.size},()=>channel.bulkDelete(recent,true));
      await logger.log(i.guild,'moderation','purge',{actor:i.user.id,reason:`Kanaal ${channel.id}`,result:`${removed.size} verwijderd; ${messages.size-removed.size} overgeslagen`});
      return i.editReply(payload(i.guild,c,'Berichten verwijderd',`${removed.size} verwijderd. ${messages.size-removed.size} overgeslagen wegens ouderdom.`));
    }
    if (['lock','unlock'].includes(name)) return this.lock(i,actor,c,name);
    const reason = text(i.options.getString('reden') || 'Waarschuwingen door moderator ingetrokken');
    const targetId = name === 'unban' ? id(i.options.getString('gebruiker_id')) : user.id;
    const flag = ['ban','unban'].includes(name) ? P.BanMembers : name === 'kick' ? P.KickMembers : P.ModerateMembers;
    const me = await botPermissions(i.guild,[flag]);
    let target;
    if (name !== 'unban') { target = await i.guild.members.fetch({user:targetId,force:true}); hierarchy(actor,target,me,c,this.ctx.env); }
    else if ([actor.id,me.id,i.guild.ownerId].includes(targetId)) throw new UserError('Dit account is beschermd.');
    if (name === 'clearwarnings') {
      const n = store.run("UPDATE sanctions SET active=0 WHERE guild_id=? AND user_id=? AND kind='warn' AND active=1",i.guildId,targetId).changes;
      this.sanction(i,targetId,'clearwarnings',reason);
      await logger.log(i.guild,'moderation',name,{actor:i.user.id,target:targetId,reason,result:`${n} ingetrokken`});
      return i.editReply(payload(i.guild,c,'Waarschuwingen ingetrokken',`${n} actieve waarschuwingen ingetrokken; historie blijft bewaard.`));
    }
    let expires = null, pendingId = null;
    if (name === 'timeout') {
      if (!target.moderatable) throw new UserError('Dit lid kan geen timeout krijgen (bijvoorbeeld Administrator).');
      expires = Date.now() + duration(i.options.getString('duur'),28*86400000);
    }
    if (name === 'untimeout' && !target.moderatable) throw new UserError('De bot kan deze timeout niet wijzigen.');
    if (name === 'ban') {
      if (!target.bannable) throw new UserError('De bot kan dit lid niet bannen.');
      const d = i.options.getString('duur');
      if (d) { if (!c.moderation.temporaryBans) throw new UserError('Tijdelijke bans zijn niet ingeschakeld.'); expires = Date.now()+duration(d); }
    }
    if (name === 'kick' && !target.kickable) throw new UserError('De bot kan dit lid niet kicken.');
    if (name === 'unban') await i.guild.bans.fetch(targetId);
    const token = randomUUID(), auditReason = `RLRP:${token} | ${i.user.id} | ${reason}`.slice(0,512);
    if (name === 'ban') pendingId = this.sanction(i,targetId,'ban',reason,expires,token,'pending');
    try {
      await mutate(this.ctx,i,name,targetId,{reason,expires,token},async () => {
        if (name === 'ban') await i.guild.members.ban(targetId,{reason:auditReason});
        if (name === 'unban') await i.guild.members.unban(targetId,auditReason);
        if (name === 'kick') await target.kick(auditReason);
        if (name === 'timeout') await target.timeout(expires-Date.now(),auditReason);
        if (name === 'untimeout') await target.timeout(null,auditReason);
      },() => {
        if (pendingId) store.run("UPDATE sanctions SET state='applied' WHERE id=?",pendingId);
        else this.sanction(i,targetId,name,reason,expires);
        if (name === 'unban') store.run("UPDATE sanctions SET active=0,state='revoked' WHERE guild_id=? AND user_id=? AND kind='ban'",i.guildId,targetId);
        if (name === 'untimeout') store.run("UPDATE sanctions SET active=0 WHERE guild_id=? AND user_id=? AND kind='timeout'",i.guildId,targetId);
      });
    } catch (e) { throw e; }
    await logger.log(i.guild,'moderation',name,{actor:i.user.id,target:targetId,reason,result:expires ? `Vervalt op ${new Date(expires).toISOString()}` : 'geslaagd'});
    if (user && c.moderation.dm) await dm(this.ctx,i.guild,user,payload(i.guild,c,'Moderatiemaatregel',`${name}\nReden: ${reason}${expires ? `\nTot <t:${Math.floor(expires/1000)}:f>` : ''}`));
    return i.editReply(payload(i.guild,c,'Moderatie uitgevoerd',`${name} • <@${targetId}>\n${reason}`));
  }
  async lock(i,actor,c,name) {
    const { store, logger } = this.ctx, ch = i.channel, me = await botPermissions(i.guild,[P.ManageChannels,P.ManageRoles]);
    if (!ch?.permissionOverwrites || ch.isThread() || !ch.permissionsFor(me).has([P.ManageChannels,P.ManageRoles]) || (!isManagement(actor,c,this.ctx.env) && !ch.permissionsFor(actor).has(P.ManageChannels))) throw new UserError('Dit kanaal ondersteunt deze actie niet of kanaalrechten ontbreken.');
    const existing = store.get('SELECT * FROM locks WHERE guild_id=? AND channel_id=?',i.guildId,ch.id);
    const flags = ['SendMessages','SendMessagesInThreads','CreatePublicThreads','CreatePrivateThreads'];
    if (name === 'lock') {
      if (existing) throw new UserError('Dit kanaal is al door de bot gesloten.');
      const overwrite = ch.permissionOverwrites.cache.get(i.guildId);
      const previous = Object.fromEntries(flags.map(k=>[k,overwrite?.allow.has(P[k]) ? true : overwrite?.deny.has(P[k]) ? false : null]));
      // Snapshot vóór de REST-call: unlock is ook na een crash mogelijk.
      store.run('INSERT INTO locks VALUES (?,?,?,?,?)',i.guildId,ch.id,JSON.stringify(previous),i.user.id,Date.now());
      await mutate(this.ctx,i,'lock',null,{channel:ch.id},()=>ch.permissionOverwrites.edit(i.guildId,Object.fromEntries(flags.map(k=>[k,false])),{reason:`RLRP lock door ${i.user.id}`}));
    } else {
      if (!existing) throw new UserError('Geen opgeslagen kanaalslot gevonden.');
      await mutate(this.ctx,i,'unlock',null,{channel:ch.id},()=>ch.permissionOverwrites.edit(i.guildId,JSON.parse(existing.previous),{reason:`RLRP unlock door ${i.user.id}`}),()=>store.run('DELETE FROM locks WHERE guild_id=? AND channel_id=?',i.guildId,ch.id));
    }
    await logger.log(i.guild,'moderation',name,{actor:i.user.id,reason:`Kanaal ${ch.id}`});
    return i.editReply(payload(i.guild,c,'Kanaalrechten bijgewerkt',`<#${ch.id}> ${name === 'lock' ? 'gesloten voor @everyone' : 'hersteld'}. Rollen met een eigen toestemming kunnen toegang behouden.`));
  }
}
