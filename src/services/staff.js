import { PermissionFlagsBits as P } from 'discord.js';
import { botPermissions, hierarchy, grantable, writable } from '../security/permissions.js';
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
    const configuredRoles = name === 'ontslag' ? [...new Set([...c.roles.ranks.map(r=>r.roleId),...c.roles.management,...c.roles.moderator,...c.roles.support])] : c.roles.ranks.map(r=>r.roleId);
    const oldRoles = target.roles.cache.filter(r=>configuredRoles.includes(r.id));
    const oldRank = c.roles.ranks.filter(r=>oldRoles.has(r.roleId)).sort((a,b)=>b.level-a.level)[0];
    let rank = null;
    if (name !== 'ontslag') {
      const rankName = text(i.options.getString(name === 'aannemen' ? 'functie' : 'nieuwe_rank'),50);
      rank = c.roles.ranks.find(r=>r.name.toLowerCase() === rankName.toLowerCase());
      if (!rank) throw new UserError('Rank niet geconfigureerd. Voeg de echte rol toe via /setup.');
      if((this.ctx.env.ownerRoles || []).includes(rank.roleId)) throw new UserError('Ownerrollen mogen niet via staffcommands worden toegekend.');
      grantable(member,await i.guild.roles.fetch(rank.roleId),me);
      if (name === 'aannemen' && existing && existing.status !== 'ontslagen') throw new UserError('Deze gebruiker is al geregistreerd als staff. Gebruik /staffupdate.');
      if (name === 'staffupdate') {
        if (!existing || existing.status === 'ontslagen' || !oldRank) throw new UserError('Er is geen bestaande staffrank op Discord. Controleer de configuratie en historie.');
        const type = i.options.getString('type');
        if ((type === 'rank-up' && rank.level <= oldRank.level) || (type === 'rank-down' && rank.level >= oldRank.level)) throw new UserError('De nieuwe rank past niet bij de gekozen richting.');
      }
    } else if (!existing || existing.status === 'ontslagen') throw new UserError('Deze gebruiker is niet in dienst volgens de database.');
    const channelKey = name === 'aannemen' ? 'hiring' : name === 'ontslag' ? 'dismissal' : 'staffUpdates';
    await writable(i.guild,c.channels[channelKey]);
    const removeRoles = name === 'ontslag' ? (i.options.getBoolean('rol_verwijderen') ?? c.staff.removeRolesOnDismissal) : true;
    if (removeRoles) for (const role of oldRoles.values()) grantable(member,role,me);
    const note = i.options.getString('opmerking');
    await mutate(this.ctx,i,name,user.id,{oldRoles:[...oldRoles.keys()],newRole:rank?.roleId || null,reason},async action => {
      if (rank) await target.roles.add(rank.roleId,`RLRP ${name} ${action}`);
      if (removeRoles) {
        const remove = [...oldRoles.keys()].filter(r=>r !== rank?.roleId);
        if (remove.length) await target.roles.remove(remove,`RLRP ${name} ${action}`);
      }
    },() => {
      store.run('INSERT INTO staff VALUES (?,?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET rank=excluded.rank,status=excluded.status,updated_at=excluded.updated_at',i.guildId,user.id,rank?.name || existing?.rank || null,name === 'ontslag' ? 'ontslagen' : 'actief',Date.now());
      this.history(i,user.id,name === 'staffupdate' ? i.options.getString('type') : name,oldRank?.name || existing?.rank || null,rank?.name || null,reason,note);
      const direction=name==='ontslag' || (name==='staffupdate' && i.options.getString('type')==='rank-down') ? 'downvote' : 'upvote';
      const vote=brandEmoji(i.guild,c,direction),voteText=vote?.toString() || (direction==='upvote' ? '⬆️' : '⬇️');
      const description = name === 'aannemen' ? `<@${user.id}>\n**Aangenomen ➜ <@&${rank.roleId}>**\n\nWelkom ${user.username} ❤️` : name === 'ontslag' ? `**Ontslagen ➜ <@${user.id}>**\nReden: ${reason}` : `**${i.options.getString('type')} ➜ <@&${rank.roleId}>**\n<@${user.id}> • ${oldRank?.name || '—'} ➜ ${rank.name}\nReden: ${reason}`;
      const e = embed(i.guild,c,`${voteText} | ${name==='aannemen' ? target.displayName : name==='ontslag' ? 'Staffontslag' : direction==='upvote' ? 'Staffpromotie' : 'Staffdemotie'}`,description,{user});
      if(vote) e.setThumbnail(vote.imageURL({extension:'webp',size:128}));
      else if(direction==='upvote') e.setThumbnail('https://cdn.discordapp.com/emojis/1539529905417490462.webp?size=80');
      store.queue(i.guildId,c.channels[channelKey],{embeds:[e.toJSON()],reaction:logo(i.guild,c) || null});
    });
    await logger.log(i.guild,'staff',name,{actor:i.user.id,target:user.id,reason,result:`${oldRank?.name || existing?.rank || '—'} ➜ ${rank?.name || 'ontslagen'}`});
    if (c.staff.dm) await dm(this.ctx,i.guild,user,payload(i.guild,c,'Staffwijziging',`${name}: ${rank?.name || 'ontslag'}\nReden: ${reason}`));
    await i.editReply(payload(i.guild,c,'Staffwijziging uitgevoerd',`<@${user.id}> • ${rank?.name || 'ontslagen'}\nDe publicatie staat in de persistente verzendwachtrij.`));
  }
  history(i,user,kind,oldRank,newRank,reason,note=null) {
    this.ctx.store.run('INSERT INTO staff_history(guild_id,user_id,actor,kind,old_rank,new_rank,reason,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)',i.guildId,user,i.user.id,kind,oldRank,newRank,reason,note,Date.now());
  }
  async warning(i,member,c,sub) {
    const { store, logger } = this.ctx;
    if (sub === 'bekijken') {
      const user = i.options.getUser('gebruiker');
      const rows = store.all('SELECT * FROM staff_warnings WHERE guild_id=? AND user_id=? ORDER BY id DESC',i.guildId,user.id);
      return showView(this.ctx,i,'Interne staffwaarschuwingen',rows.map(r=>`#${r.id} • ${stamp(r.created_at)} • <@${r.actor}>\n${r.reason}\n${r.revoked_at ? `Ingetrokken door <@${r.revoked_by}>` : 'Actief'}`).join('\n\n'),'staffwaarschuwing.bekijken');
    }
    const channel = await writable(i.guild,c.channels.staffWarnings,{privateStaff:true,c});
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
