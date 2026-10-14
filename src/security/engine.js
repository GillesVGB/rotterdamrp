import { AuditLogEvent as A, PermissionFlagsBits as P } from 'discord.js';
import { isTrusted, hasDanger } from './permissions.js';
import { integer, id, UserError } from '../utils/validation.js';
import { payload } from '../utils/embeds.js';
import { showView } from '../services/views.js';
import { redact } from '../services/logging.js';
export const auditRules = new Map([
  [A.ChannelCreate,'channelCreate'],[A.ChannelDelete,'channelDelete'],[A.ChannelUpdate,'channelUpdate'],
  [A.ChannelOverwriteCreate,'channelUpdate'],[A.ChannelOverwriteUpdate,'channelUpdate'],[A.ChannelOverwriteDelete,'channelUpdate'],
  [A.RoleCreate,'roleCreate'],[A.RoleDelete,'roleDelete'],[A.RoleUpdate,'roleUpdate'],[A.MemberRoleUpdate,'roleUpdate'],
  [A.WebhookCreate,'webhook'],[A.WebhookUpdate,'webhook'],[A.WebhookDelete,'webhook'],
  [A.MemberBanAdd,'ban'],[A.MemberKick,'kick'],[A.GuildUpdate,'guildUpdate']
]);
export const exceeds = (count,rule) => count >= rule.limit;
export class SecurityEngine {
  constructor(ctx) { this.ctx = ctx; }
  async execute(i,actor,c) {
    const { store,logger } = this.ctx, sub = i.options.getSubcommand();
    if (sub === 'status') {
      const rows = store.all('SELECT * FROM incidents WHERE guild_id=? ORDER BY id DESC LIMIT 20',i.guildId);
      const me = await i.guild.members.fetchMe();
      return showView(this.ctx,i,'Anti-Nuke status',`Actie: ${c.security.action}\nAuditlogs: ${me.permissions.has(P.ViewAuditLog) ? 'toegankelijk' : 'ONTBREKEN'}\nAllowlist gebruikers: ${c.security.allowUsers.length}\nAllowlist bots: ${c.security.allowBots.length}\n\n${Object.entries(c.security.rules).map(([k,v])=>`${k}: ${v.limit} / ${v.windowSeconds}s`).join('\n')}\n\nRecente incidenten\n${rows.map(r=>`#${r.id} ${r.rule} • ${r.actor ? `<@${r.actor}>` : 'onbekend'} • ${r.result}`).join('\n') || 'Geen incidenten.'}`,'antinuke.status');
    }
    const rule = i.options.getString('regel');
    if (sub === 'test') {
      const count = i.options.getInteger('aantal'), threshold = c.security.rules[rule];
      await logger.log(i.guild,'security','Anti-Nuke simulatie',{actor:i.user.id,reason:rule,result:`${count}/${threshold.limit}; uitsluitend simulatie`});
      return i.editReply(payload(i.guild,c,'Veilige simulatie',`${count} acties binnen ${threshold.windowSeconds}s.\nDrempel: ${threshold.limit}.\nBeslissing: ${exceeds(count,threshold) ? `melding en ${c.security.action} bij niet-vrijgestelde actor` : 'geen interventie'}.\nGeen Discord-mutaties of productiehits uitgevoerd.`));
    }
    const value = i.options.getString('waarde'), {revision,...updated} = c;
    if (['allowUser','allowBot'].includes(rule)) {
      const snowflake = id(value);
      const user = await this.ctx.client.users.fetch(snowflake);
      if ((rule === 'allowBot') !== user.bot) throw new UserError('Het ID past niet bij gebruiker/bot.');
      const key = rule === 'allowBot' ? 'allowBots' : 'allowUsers';
      updated.security[key] = i.options.getBoolean('verwijderen') ? updated.security[key].filter(x=>x !== snowflake) : [...new Set([...updated.security[key],snowflake])];
    } else if (rule === 'action') updated.security.action = value;
    else updated.security.rules[rule] = { limit:integer(value,1,50),windowSeconds:i.options.getInteger('venster') || updated.security.rules[rule].windowSeconds };
    store.saveConfig(i.guildId,updated,revision);
    await logger.log(i.guild,'security','Beveiligingsconfiguratie gewijzigd',{actor:i.user.id,reason:`${rule}: ${value}`});
    return i.editReply(payload(i.guild,updated,'Beveiliging opgeslagen',`${rule} bijgewerkt.`));
  }
  async audit(entry,guild) {
    const rule = auditRules.get(entry.action);
    if (!rule || guild.id !== this.ctx.env.guildId || Date.now()-entry.createdTimestamp > 300000 || !this.ctx.store.onceAudit(entry.id)) return;
    const actor = entry.executorId;
    if (!actor) return this.incident(guild,null,rule,'Geen uitvoerder in auditlog; geen accountactie.');
    const c = this.ctx.store.config(guild.id), threshold = c.security.rules[rule];
    const count = this.ctx.store.hit(guild.id,actor,rule,threshold.windowSeconds*1000,entry.createdTimestamp);
    // Attributie komt uit een specifieke audit-entry, nooit uit de eerste willekeurige auditlogregel.
    if (exceeds(count,threshold)) await this.ctx.mutex.run(`security:${actor}`,()=>this.intervene(guild,actor,rule,`${count} acties/${threshold.windowSeconds}s`));
    else if (rule === 'roleUpdate') {
      const change = entry.changes?.find(x=>x.key === 'permissions');
      if (change && (BigInt(change.new || 0) & ~BigInt(change.old || 0)) !== 0n) await this.ctx.logger.log(guild,'security','Rolrechten uitgebreid',{actor,target:null,reason:`Rol ${entry.targetId}`,result:'Waargenomen; threshold actief.'});
    }
  }
  async observed(guild,rule,target) {
    if (guild.id !== this.ctx.env.guildId) return;
    const me = await guild.members.fetchMe();
    if (!me.permissions.has(P.ViewAuditLog)) return this.incident(guild,null,rule,`Event ${target}; auditrechten ontbreken. Geen accountactie.`);
    // REST-fallback met exact target, type en recent tijdvenster; deduplicatie deelt dezelfde audit-ID.
    const type = [...auditRules].find(([,r])=>r === rule)?.[0];
    if (!type) return;
    const logs = await guild.fetchAuditLogs({type,limit:6});
    const matching = logs.entries.filter(e=>String(e.targetId) === String(target) && Math.abs(Date.now()-e.createdTimestamp) < 10000);
    if (matching.size) for (const entry of matching.values()) await this.audit(entry,guild);
    else await this.ctx.logger.log(guild,'security',`Event ${rule}`,{reason:`Object ${target}`,result:'Attributie nog onbekend; geen accountactie. Auditlog-event blijft actief.'});
  }
  async incident(guild,actor,rule,result) {
    result=redact(result,this.ctx.env);
    this.ctx.store.run('INSERT INTO incidents(guild_id,actor,rule,result,created_at) VALUES (?,?,?,?,?)',guild.id,actor,rule,result,Date.now());
    await this.ctx.logger.log(guild,'security',`🚨 Beveiliging: ${rule}`,{actor,reason:rule,result});
  }
  async intervene(guild,actorId,rule,reason) {
    const { store,env } = this.ctx, c = store.config(guild.id);
    const last = store.get('SELECT created_at FROM incidents WHERE guild_id=? AND actor=? AND rule=? ORDER BY id DESC LIMIT 1',guild.id,actorId,rule);
    if (last && Date.now()-last.created_at < 30000) return;
    let member;
    try { member = await guild.members.fetch(actorId); } catch(e) { return this.incident(guild,actorId,rule,`Actor niet bereikbaar: ${e.code || 'API-fout'}; geen accountactie.`); }
    if (isTrusted(member,c,env)) return this.incident(guild,actorId,rule,`${reason}; expliciet vertrouwd, uitsluitend melding.`);
    const me = await guild.members.fetchMe();
    if (me.roles.highest.comparePositionTo(member.roles.highest) <= 0) return this.incident(guild,actorId,rule,`${reason}; actor boven bot, beperking onmogelijk.`);
    const action = store.begin(guild.id,me.id,actorId,`security:${rule}`,{reason,policy:c.security.action});
    try {
      let result = 'Uitsluitend melding volgens configuratie.';
      if (c.security.action === 'strip') {
        if (!me.permissions.has(P.ManageRoles)) throw new Error('ManageRoles ontbreekt.');
        const removable = member.roles.cache.filter(r=>r.id !== guild.id && !r.managed && me.roles.highest.comparePositionTo(r)>0 && hasDanger(r.permissions));
        if (removable.size) await member.roles.remove([...removable.keys()],`RLRP Anti-Nuke ${rule}: ${reason}`.slice(0,512));
        result = `${removable.size} gevaarlijke rollen verwijderd. Managed/integratierollen kunnen niet worden verwijderd.`;
      } else if (c.security.action === 'timeout') {
        if (!me.permissions.has(P.ModerateMembers) || !member.moderatable) throw new Error('Timeout niet toegestaan voor dit account.');
        await member.timeout(3600000,`RLRP Anti-Nuke ${rule}`); result = 'Timeout 1 uur uitgevoerd.';
      }
      store.finish(action); await this.incident(guild,actorId,rule,`${reason}; ${result}`);
    } catch(e) { store.finish(action,'uncertain',redact(e.message,env)); await this.incident(guild,actorId,rule,`${reason}; beperking mislukt: ${e.message}`); }
  }
  async message(message) {
    if (!message.guild || message.guild.id !== this.ctx.env.guildId || !message.author || message.author.id === this.ctx.client.user.id) return;
    const { store } = this.ctx, c = store.config(message.guild.id);
    if (message.webhookId) {
      const n = store.hit(message.guild.id,message.webhookId,'webhookMessages',c.security.webhookMessages.windowSeconds*1000);
      if (exceeds(n,c.security.webhookMessages)) {
        await this.ctx.mutex.run(`webhook:${message.webhookId}`,async()=>{
          const last = store.get("SELECT created_at FROM incidents WHERE guild_id=? AND actor=? AND rule='webhookMessages' ORDER BY id DESC LIMIT 1",message.guild.id,message.webhookId);
          if (last && Date.now()-last.created_at<30000) return;
          let result = 'Webhookburst; verwijdering niet mogelijk.';
          try {
            const hook = await this.ctx.client.fetchWebhook(message.webhookId);
            let trustedOwner=hook.owner && (c.security.allowUsers.includes(hook.owner.id) || c.security.allowBots.includes(hook.owner.id) || this.ctx.env.owners.includes(hook.owner.id) || hook.owner.id===message.guild.ownerId || hook.owner.id===this.ctx.client.user.id);
            if(hook.owner && !trustedOwner) {
              try {trustedOwner=isTrusted(await message.guild.members.fetch({user:hook.owner.id,force:true}),c,this.ctx.env);}
              catch(e) {if(e.code!==10007) throw e;}
            }
            if (trustedOwner) result = 'Vertrouwde webhookeigenaar; uitsluitend melding.';
            else if (hook.owner && c.security.action !== 'alert') { await hook.delete('RLRP anti-webhook abuse'); result = 'Webhook verwijderd wegens burst.'; }
            else result = 'Eigenaar onbekend of alertmodus; uitsluitend melding.';
          } catch(e) { result = `Webhookburst: ${e.message}`; }
          await this.incident(message.guild,message.webhookId,'webhookMessages',result);
        });
      }
      return;
    }
    if (message.author?.bot) return;
    const member = message.member || await message.guild.members.fetch(message.author.id);
    const spam = store.hit(message.guild.id,member.id,'spam',c.security.spam.windowSeconds*1000);
    const mentions = message.mentions.users.size + message.mentions.roles.size;
    const kind = message.mentions.everyone || mentions >= c.security.mentions.limit ? 'mentions' : exceeds(spam,c.security.spam) ? 'spam' : null;
    if (!kind) return;
    await this.ctx.mutex.run(`abuse:${member.id}`,async()=>{
      const last = store.get('SELECT created_at FROM incidents WHERE guild_id=? AND actor=? AND rule=? ORDER BY id DESC LIMIT 1',message.guild.id,member.id,kind);
      if (last && Date.now()-last.created_at<30000) return;
      if (isTrusted(member,c,this.ctx.env) || member.permissions.has(P.Administrator)) return this.incident(message.guild,member.id,kind,'Vertrouwd of Administrator; uitsluitend melding.');
      const outcomes = [];
      try { if (message.deletable) { await message.delete(); outcomes.push('bericht verwijderd'); } } catch(e) { outcomes.push(`verwijdering mislukt: ${e.message}`); }
      try { if (member.moderatable) { await member.timeout(c.security[kind].timeoutSeconds*1000,`RLRP anti-${kind}`); outcomes.push('timeout uitgevoerd'); } else outcomes.push('timeout onmogelijk'); }
      catch(e) { outcomes.push(`timeout mislukt: ${e.message}`); }
      await this.incident(message.guild,member.id,kind,outcomes.join('; '));
      store.run('INSERT INTO sanctions(guild_id,user_id,actor,kind,reason,created_at,expires_at,state) VALUES (?,?,?,?,?,?,?,?)',message.guild.id,member.id,this.ctx.client.user.id,`auto-${kind}`,outcomes.join('; '),Date.now(),Date.now()+c.security[kind].timeoutSeconds*1000,outcomes.includes('timeout uitgevoerd') ? 'applied' : 'failed');
    });
  }
  async join(member) {
    const { store,env } = this.ctx, guild = member.guild;
    if (guild.id !== env.guildId) return;
    const c = store.config(guild.id), trusted = isTrusted(member,c,env);
    if (member.user.bot && !trusted) {
      try { if (!member.kickable) throw new Error('Botrol te hoog of KickMembers ontbreekt.'); await member.kick('RLRP: bot niet op expliciete allowlist'); await this.incident(guild,member.id,'botInvite','Niet-toegestane bot verwijderd.'); }
      catch(e) { await this.incident(guild,member.id,'botInvite',`Verwijdering mislukt: ${e.message}`); }
      return;
    }
    if (member.user.bot) return;
    const n = store.hit(guild.id,'guild','joins',c.security.raid.windowSeconds*1000);
    store.hit(guild.id,member.id,'join',c.security.raid.windowSeconds*1000);
    if (exceeds(n,c.security.raid)) await this.ctx.mutex.run('raid',async()=>{
      const recent=store.get("SELECT created_at FROM incidents WHERE guild_id=? AND rule='raid' ORDER BY id DESC LIMIT 1",guild.id);
      if(recent && Date.now()-recent.created_at<30000) {
        if(!trusted && member.moderatable && !member.communicationDisabledUntilTimestamp) {
          try {await member.timeout(c.security.raid.timeoutSeconds*1000,'RLRP join-rate-limit');}
          catch(e) {await this.ctx.logger.error(guild,'Join-rate-limit mislukt',e);}
        }
        return;
      }
      const rows = store.all("SELECT DISTINCT actor FROM hits WHERE guild_id=? AND rule='join' AND created_at>=?",guild.id,Date.now()-c.security.raid.windowSeconds*1000);
      let limited = 0, failed = 0;
      for (const r of rows) {
        try {
          const m = await guild.members.fetch(r.actor);
          if (!isTrusted(m,c,env) && m.moderatable && !m.communicationDisabledUntilTimestamp) { await m.timeout(c.security.raid.timeoutSeconds*1000,'RLRP join-rate-limit / anti-raid'); limited++; }
        } catch { failed++; }
      }
      await this.incident(guild,null,'raid',`${n} joins; ${limited} recente leden beperkt, ${failed} fouten.`);
    });
  }
}
