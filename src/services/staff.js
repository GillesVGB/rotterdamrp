import { PermissionFlagsBits as P } from 'discord.js';
import { botPermissions, hierarchy, grantable, writable,isManagement } from '../security/permissions.js';
import { embed, payload, logo, brandEmoji } from '../utils/embeds.js';
import { UserError, text } from '../utils/validation.js';
import { mutate, dm } from './logging.js';
import { showView } from './views.js';

const stamp = n => `<t:${Math.floor(n/1000)}:f>`;
export class StaffService {
  constructor(ctx) { this.ctx = ctx; }
  async execute(i, member, c) {
    const { store, logger } = this.ctx, name = i.commandName;
    const user = i.options.getUser('gebruiker'), sub = i.options.getSubcommand(false);
    const existing = user ? store.get('SELECT * FROM staff WHERE guild_id=? AND user_id=?', i.guildId,user.id) : null;
    if (name === 'staffoverzicht') {
      const rows = store.all('SELECT * FROM staff WHERE guild_id=? ORDER BY status,rank,user_id',i.guildId);
      return showView(this.ctx,i,'Staffoverzicht',rows.map(r=>`<@${r.user_id}> • ${r.rank || '—'} • ${r.status}`).join('\n'),'staffoverzicht');
    }
    if (name === 'staffgeschiedenis') {
      const rows = store.all('SELECT * FROM staff_history WHERE guild_id=? AND user_id=? ORDER BY id DESC',i.guildId,user.id);
      return showView(this.ctx,i,`Staffgeschiedenis • ${user.username}`,rows.map(r=>`#${r.id} ${stamp(r.created_at)} • ${r.kind}\n${r.old_rank || '—'} ➜ ${r.new_rank || '—'} • <@${r.actor}>\n${r.reason}${r.note ? `\nOpmerking: ${r.note}` : ''}`).join('\n\n'),'staffgeschiedenis');
    }
    if (name === 'staffstats') {
      const statuses = store.all('SELECT status,COUNT(*) AS n FROM staff WHERE guild_id=? GROUP BY status',i.guildId);
      const history = store.all('SELECT kind,COUNT(*) AS n FROM staff_history WHERE guild_id=? GROUP BY kind',i.guildId);
      return i.editReply(payload(i.guild,c,'Staffstatistieken',`Medewerkers\n${statuses.map(r=>`${r.status}: ${r.n}`).join('\n') || '0'}\n\nGeregistreerde acties\n${history.map(r=>`${r.kind}: ${r.n}`).join('\n') || '0'}`));
    }
    if (name === 'staffwaarschuwing') return this.warning(i,member,c,sub);
    if (!user) throw new UserError('Gebruiker ontbreekt.');
    const target = await i.guild.members.fetch({user:user.id,force:true}), me = await botPermissions(i.guild,[P.ManageRoles]);
    hierarchy(member,target,me,c,this.ctx.env);
    const reason = text(i.options.getString('reden') || 'Geen reden opgegeven');
    if (['staffstatus','staffopmerking'].includes(name)) {
      if (!existing || existing.status === 'ontslagen') throw new UserError('Deze gebruiker is geen geregistreerde medewerker.');
      const note = name === 'staffopmerking' ? text(i.options.getString('opmerking')) : null;
      const status = i.options.getString('status');
      store.transaction(() => {
        if (status) store.run('UPDATE staff SET status=?,updated_at=? WHERE guild_id=? AND user_id=?',status,Date.now(),i.guildId,user.id);
        this.history(i,user.id,name,existing.rank,existing.rank,reason,note);
      });
      await logger.log(i.guild,'staff',name,{actor:i.user.id,target:user.id,reason:note ? 'Interne opmerking opgeslagen; details via /staffgeschiedenis.' : reason});
      return i.editReply(payload(i.guild,c,'Staffregistratie opgeslagen',`<@${user.id}>${status ? ` • ${status}` : ''}`));
    }
    const pastRoles=store.all('SELECT new_role_id FROM staff_history WHERE guild_id=? AND user_id=? AND new_role_id IS NOT NULL',i.guildId,user.id).map(r=>r.new_role_id);
    const configuredRoles = [...new Set([...c.roles.ranks.map(r=>r.roleId),...(existing?.role_id ? [existing.role_id] : []),...pastRoles,...(name === 'ontslag' ? [...c.roles.moderator,...c.roles.support] : [])])];
    const oldRoles = target.roles.cache.filter(r=>configuredRoles.includes(r.id));
    const oldRole = (existing?.role_id && oldRoles.get(existing.role_id)) || [...oldRoles.values()].sort((a,b)=>b.comparePositionTo(a))[0];
    const oldRank = oldRole ? {name:c.roles.ranks.find(r=>r.roleId===oldRole.id)?.name || existing?.rank || oldRole.name,roleId:oldRole.id,level:oldRole.position} : null;
    const management=isManagement(member,c,this.ctx.env);
    let rank = null;
    if (name !== 'ontslag') {
      const selected = i.options.getRole(name === 'aannemen' ? 'functie' : 'nieuwe_rank',true);
      const role=selected?.id ? await i.guild.roles.fetch(selected.id) : null;
      if(!role) throw new UserError('Selecteer een bestaande Discord-rol.');
      if([...(this.ctx.env.ownerRoles || []),...(this.ctx.env.managementRoles || []),...c.roles.management,...c.roles.protected].includes(role.id)) throw new UserError('Ownerrollen en beschermde beheerrollen mogen niet via staffcommands worden toegekend.');
      grantable(member,role,me,management);
      rank={name:c.roles.ranks.find(r=>r.roleId===role.id)?.name || role.name,roleId:role.id,level:role.position};
      if (name === 'aannemen' && existing && existing.status !== 'ontslagen') throw new UserError('Deze gebruiker is al geregistreerd als staff. Gebruik /staffupdate.');
      if (name === 'staffupdate') {
        if (!existing || existing.status === 'ontslagen' || !oldRank) throw new UserError('Er is geen bestaande staffrank op Discord. Controleer de staffhistorie en rollen.');
        const type = i.options.getString('type');
        const direction=role.comparePositionTo(oldRole);
        if ((type === 'rank-up' && direction <= 0) || (type === 'rank-down' && direction >= 0)) throw new UserError('De nieuwe rank past niet bij de gekozen richting.');
      }
    } else if (!existing || existing.status === 'ontslagen') throw new UserError('Deze gebruiker is niet in dienst volgens de database.');
    const channelKey = name === 'aannemen' ? 'hiring' : name === 'ontslag' ? 'dismissal' : 'staffUpdates';
    await writable(i.guild,c.channels[channelKey]);
    for (const role of oldRoles.values()) grantable(member,role,me,management);
    const note = i.options.getString('opmerking');
    await mutate(this.ctx,i,name,user.id,{oldRoles:[...oldRoles.keys()],newRole:rank?.roleId || null,reason},async action => {
      if (rank) await target.roles.add(rank.roleId,`RLRP ${name} ${action}`);
      const remove = [...oldRoles.keys()].filter(r=>r !== rank?.roleId);
      // Een array veroorzaakt bij discord.js een volledige PATCH op basis van de
      // oude cache. De losse DELETE-route behoudt de zojuist toegevoegde rol.
      for(const roleId of remove) await target.roles.remove(roleId,`RLRP ${name} ${action}`);
    },() => {
      store.run('INSERT INTO staff(guild_id,user_id,rank,status,updated_at,role_id) VALUES (?,?,?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET rank=excluded.rank,status=excluded.status,updated_at=excluded.updated_at,role_id=excluded.role_id',i.guildId,user.id,rank?.name || existing?.rank || null,name === 'ontslag' ? 'ontslagen' : 'actief',Date.now(),rank?.roleId || null);
      this.history(i,user.id,name === 'staffupdate' ? i.options.getString('type') : name,oldRank?.name || existing?.rank || null,rank?.name || null,reason,note,oldRank?.roleId || existing?.role_id || null,rank?.roleId || null);
      const direction=name==='ontslag' || (name==='staffupdate' && i.options.getString('type')==='rank-down') ? 'downvote' : 'upvote';
      const vote=brandEmoji(i.guild,c,direction),voteText=vote?.toString() || (direction==='upvote' ? '⬆️' : '⬇️');
      const description = name === 'aannemen' ? `<@${user.id}>\n**Aangenomen ➜ <@&${rank.roleId}>**\n\nWelkom ${user.username} ❤️` : name === 'ontslag' ? `**Ontslagen ➜ <@${user.id}>**\nReden: ${reason}` : `**${i.options.getString('type')} ➜ <@&${rank.roleId}>**\n<@${user.id}> • ${oldRank?.name || '—'} ➜ ${rank.name}\nReden: ${reason}`;
      const e = embed(i.guild,c,`${voteText} | ${name==='aannemen' ? target.displayName : name==='ontslag' ? 'Staffontslag' : direction==='upvote' ? 'Staffpromotie' : 'Staffdemotie'}`,description,{user});
      e.setThumbnail('https://cdn.discordapp.com/emojis/1560047457361072198.webp?size=80');
      store.queue(i.guildId,c.channels[channelKey],{embeds:[e.toJSON()],reaction:logo(i.guild,c) || null});
    });
    await logger.log(i.guild,'staff',name,{actor:i.user.id,target:user.id,reason,result:`${oldRank?.name || existing?.rank || '—'} ➜ ${rank?.name || 'ontslagen'}`});
    if (c.staff.dm) await dm(this.ctx,i.guild,user,payload(i.guild,c,'Staffwijziging',`${name}: ${rank?.name || 'ontslag'}\nReden: ${reason}`));
    await i.editReply(payload(i.guild,c,'Staffwijziging uitgevoerd',`<@${user.id}> • ${rank?.name || 'ontslagen'}\nDe publicatie staat in de persistente verzendwachtrij.`));
  }
  history(i,user,kind,oldRank,newRank,reason,note=null,oldRole=null,newRole=null) {
    this.ctx.store.run('INSERT INTO staff_history(guild_id,user_id,actor,kind,old_rank,new_rank,reason,note,created_at,old_role_id,new_role_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',i.guildId,user,i.user.id,kind,oldRank,newRank,reason,note,Date.now(),oldRole,newRole);
  }
  async warning(i,member,c,sub) {
    const { store, logger } = this.ctx;
    if (sub === 'bekijken') {
      const user = i.options.getUser('gebruiker');
      const rows = store.all('SELECT * FROM staff_warnings WHERE guild_id=? AND user_id=? ORDER BY id DESC',i.guildId,user.id);
      return showView(this.ctx,i,'Interne staffwaarschuwingen',rows.map(r=>`#${r.id} • ${stamp(r.created_at)} • <@${r.actor}>\n${r.reason}\n${r.revoked_at ? `Ingetrokken door <@${r.revoked_by}>` : 'Actief'}`).join('\n\n'),'staffwaarschuwing.bekijken');
    }
    const channel = await writable(i.guild,c.channels.staffWarnings,{privateStaff:true,c,env:this.ctx.env});
    const reason = text(i.options.getString('reden'));
    let userId, warningId;
    if (sub === 'geven') {
      const user = i.options.getUser('gebruiker'), target = await i.guild.members.fetch(user.id), me = await i.guild.members.fetchMe();
      hierarchy(member,target,me,c,this.ctx.env); userId = user.id;
      const staff = store.get('SELECT * FROM staff WHERE guild_id=? AND user_id=?',i.guildId,userId);
      if (!staff || staff.status === 'ontslagen') throw new UserError('Het doelwit is geen geregistreerde medewerker.');
      store.transaction(() => {
        warningId = Number(store.run('INSERT INTO staff_warnings(guild_id,user_id,actor,reason,created_at) VALUES (?,?,?,?,?)',i.guildId,userId,i.user.id,reason,Date.now()).lastInsertRowid);
        store.queue(i.guildId,channel.id,payload(i.guild,c,`Interne staffwaarschuwing #${warningId}`,`<@${userId}>\nUitvoerder: <@${i.user.id}>\nReden: ${reason}`));
      });
    } else {
      warningId = i.options.getInteger('id');
      const row = store.get('SELECT * FROM staff_warnings WHERE id=? AND guild_id=?',warningId,i.guildId);
      if (!row || row.revoked_at) throw new UserError('Geen actieve staffwaarschuwing gevonden.');
      userId = row.user_id;
      const target = await i.guild.members.fetch(userId); hierarchy(member,target,await i.guild.members.fetchMe(),c,this.ctx.env);
      store.transaction(() => {
        store.run('UPDATE staff_warnings SET revoked_at=?,revoked_by=? WHERE id=?',Date.now(),i.user.id,warningId);
        store.queue(i.guildId,channel.id,payload(i.guild,c,`Staffwaarschuwing #${warningId} ingetrokken`,`<@${userId}>\nDoor <@${i.user.id}>\nReden: ${reason}`));
      });
    }
    // De interne reden blijft in het gecontroleerde privékanaal en de aparte tabel.
    await logger.log(i.guild,'staff',`Interne waarschuwing ${sub}`,{actor:i.user.id,target:userId,reason:`Waarschuwing #${warningId}; details uitsluitend intern.`});
    return i.editReply(payload(i.guild,c,'Interne waarschuwing verwerkt',`Referentie #${warningId}`));
  }
}
