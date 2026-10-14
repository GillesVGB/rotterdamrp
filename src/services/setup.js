import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits as P } from 'discord.js';
import { authorize, writable } from '../security/permissions.js';
import { policy, commandKeys } from '../commands/registry.js';
import { payload } from '../utils/embeds.js';
import { UserError } from '../utils/validation.js';
import { validateConfig } from '../config.js';

const row = component => new ActionRowBuilder().addComponents(component);
const menu = (key, options) => row(new StringSelectMenuBuilder().setCustomId(key).setPlaceholder('Kies een instelling').addOptions(options.map(([label,value])=>({label,value}))));
export class SetupService {
  constructor(ctx) { this.ctx = ctx; }
  async open(i,actor,c) {
    const key = randomUUID();
    this.ctx.store.run('INSERT INTO sessions VALUES (?,?,?,?,?,?)',key,i.guildId,i.user.id,c.revision,'{}',Date.now()+15*60000);
    await i.editReply(this.panel(i.guild,c,key));
  }
  panel(guild,c,key) {
    return {...payload(guild,c,'RLRP configuratie',`Configuratieversie ${c.revision}\nIngestelde ranks: ${c.roles.ranks.length}\nIngestelde kanalen: ${Object.values(c.channels).filter(Boolean).length}/${Object.keys(c.channels).length}\nDeze sessie is uitsluitend voor jou en verloopt na 15 minuten.\nSecrets en FiveM-endpoints wijzig je in .env.`),components:[menu(`setup:${key}:main`,[['Kanalen','channels'],['Staff- en beschermde rollen','roles'],['Rankhiërarchie','ranks'],['Huisstijl en emoji','brand'],['Beveiliging','security'],['Vrijgestelde gebruikers','allowUsers'],['Toegestane bots','allowBots'],['Commandpermissies','permissions'],['Overige instellingen','misc']]),row(new ButtonBuilder().setCustomId(`setup:${key}:health`).setLabel('Controleer installatie').setStyle(ButtonStyle.Secondary)),row(new ButtonBuilder().setCustomId(`setup:${key}:close`).setLabel('Sluiten').setStyle(ButtonStyle.Danger))]};
  }
  async handle(i,key,action) {
    const { store } = this.ctx;
    const session = store.get('SELECT * FROM sessions WHERE id=? AND guild_id=? AND user_id=?',key,i.guildId,i.user.id);
    if (!session || session.expires_at<Date.now()) throw new UserError('Setupsessie verlopen of niet van jou. Open /setup opnieuw.');
    const {c} = await authorize(i,this.ctx,policy('setup'),'setup');
    if (session.revision!==c.revision) throw new UserError('Configuratie is gewijzigd. Open /setup opnieuw.');
    if (action === 'close') { await i.update({content:'Setup gesloten.',embeds:[],components:[]}); store.run('DELETE FROM sessions WHERE id=?',key); return; }
    if (action === 'main') {
      const section = i.values[0];
      if (section === 'channels') return i.update({...payload(i.guild,c,'Kanaalinstellingen','Kies de bestemming.'),components:[menu(`setup:${key}:channelKey`,Object.keys(c.channels).map(k=>[k,k]))]});
      if (section === 'roles') return i.update({...payload(i.guild,c,'Rolinstellingen','Kies een categorie. Commandrechten vereisen daarnaast de bijbehorende Discord-permissie.'),components:[menu(`setup:${key}:roleKey`,['management','moderator','support','protected'].map(k=>[k,k]))]});
      if (!['ranks','brand','security','allowUsers','allowBots','permissions','misc'].includes(section)) throw new UserError('Ongeldige sectie.');
      const value = section === 'ranks' ? c.roles.ranks : section === 'misc' ? {staff:c.staff,moderation:c.moderation,logging:c.logging,fivem:c.fivem} : ['allowUsers','allowBots'].includes(section) ? c.security[section] : section==='security' ? Object.fromEntries(Object.entries(c.security).filter(([k])=>!['allowUsers','allowBots'].includes(k))) : c[section];
      if(JSON.stringify(value,null,2).length>4000) throw new UserError('Deze sectie overschrijdt de Discord-modallimiet. Gebruik npm run config:export/import voor deze omvang.');
      const modal = new ModalBuilder().setCustomId(`setup:${key}:save:${section}`).setTitle(`Configuratie • ${section}`)
        .addComponents(row(new TextInputBuilder().setCustomId('json').setLabel('Geldig JSON; behoud de bestaande sleutels').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000).setValue(JSON.stringify(value,null,2))));
      return i.showModal(modal);
    }
    if (action === 'channelKey' || action === 'roleKey') {
      const topic = i.values[0];
      const valid = action === 'channelKey' ? Object.keys(c.channels) : ['management','moderator','support','protected'];
      if (!valid.includes(topic)) throw new UserError('Ongeldige configuratiesleutel.');
      store.run('UPDATE sessions SET state=? WHERE id=?',JSON.stringify({topic}),key);
      const select = action === 'channelKey' ? new ChannelSelectMenuBuilder().setCustomId(`setup:${key}:channel`).setChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement).setMinValues(0).setMaxValues(1) : new RoleSelectMenuBuilder().setCustomId(`setup:${key}:role`).setMinValues(0).setMaxValues(10);
      return i.update({...payload(i.guild,c,`Instellen • ${topic}`,'Selecteer een echt kanaal of echte rollen. Een lege selectie verwijdert deze koppeling.'),components:[row(select)]});
    }
    if (action === 'health') {
      await i.deferUpdate(); const status = await this.health(i.guild,c);
      return i.editReply({...this.panel(i.guild,c,key),embeds:payload(i.guild,c,'Installatiecontrole',status).embeds});
    }
    const { revision,...next } = c;
    await i.deferUpdate();
    if (action === 'channel' || action === 'role') {
      const topic = JSON.parse(session.state).topic;
      if (action === 'channel') {
        if (!Object.hasOwn(next.channels,topic)) throw new UserError('Kies eerst een kanaalcategorie.');
        const value = i.values[0] || null;
        if (value) await writable(i.guild,value,{privateStaff:topic==='staffWarnings',c});
        next.channels[topic]=value;
      } else {
        if (!['management','moderator','support','protected'].includes(topic)) throw new UserError('Kies eerst een rolcategorie.');
        for (const value of i.values) { const role=await i.guild.roles.fetch(value); if (!role || role.id===i.guildId) throw new UserError('@everyone is geen toegestane staffrol.'); }
        next.roles[topic]=i.values;
      }
    } else if (action.startsWith('save:')) {
      const section = action.slice(5); let parsed;
      try { parsed = JSON.parse(i.fields.getTextInputValue('json')); } catch { throw new UserError('JSON is ongeldig. Open de sectie opnieuw en corrigeer de invoer.'); }
      if (section === 'ranks') next.roles.ranks=parsed;
      else if (section === 'misc') { if (Object.keys(parsed).sort().join(',')!=='fivem,logging,moderation,staff') throw new UserError('Overige instellingen bevatten staff, moderation, logging en fivem.'); Object.assign(next,parsed); }
      else if (['allowUsers','allowBots'].includes(section)) next.security[section]=parsed;
      else if(section==='security') next.security={...parsed,allowUsers:c.security.allowUsers,allowBots:c.security.allowBots};
      else if (['brand','permissions'].includes(section)) next[section]=parsed;
      else throw new UserError('Ongeldige sectie.');
      validateConfig(next);
      if (section === 'permissions') for (const name of Object.keys(parsed)) {
        const [root,sub] = name.split('.');
        if (!commandKeys().includes(name) || policy(root,sub).scope==='public' || policy(root,sub).owner) throw new UserError(`Geen toegestane override: ${name}`);
      }
      if (section === 'ranks') for (const rank of next.roles.ranks) {
        const role = await i.guild.roles.fetch(rank.roleId), me = await i.guild.members.fetchMe();
        if (!role || role.managed || role.id===i.guildId || me.roles.highest.comparePositionTo(role)<=0) throw new UserError(`Rank ${rank.name} is niet toewijsbaar door de bot.`);
      }
      if (['security','allowUsers','allowBots'].includes(section)) for (const type of ['allowUsers','allowBots']) for (const uid of next.security[type]) {
        const user=await this.ctx.client.users.fetch(uid); if (user.bot!==(type==='allowBots')) throw new UserError(`Verkeerd accounttype in ${type}.`);
      }
    } else throw new UserError('Onbekende setupactie.');
    store.saveConfig(i.guildId,next,revision);
    store.run('UPDATE sessions SET revision=?,state=? WHERE id=?',revision+1,'{}',key);
    await this.ctx.logger.log(i.guild,'security','Setupconfiguratie gewijzigd',{actor:i.user.id,reason:action});
    return i.editReply(this.panel(i.guild,store.config(i.guildId),key));
  }
  async health(guild,c) {
    const me = await guild.members.fetchMe(), required = ['ViewAuditLog','ManageRoles','ManageChannels','ManageWebhooks','BanMembers','KickMembers','ModerateMembers','ManageMessages','CreateEvents','ManageEvents','AttachFiles','AddReactions'];
    const missing = required.filter(k=>!me.permissions.has(P[k]));
    const lines = [`Ontbrekende serverpermissies: ${missing.join(', ') || 'geen'}`,`Botrol: ${me.roles.highest.name}`];
    for(const rid of this.ctx.env.ownerRoles || []) {const role=await guild.roles.fetch(rid);lines.push(`Ownerrol ${rid}: ${role && rid!==guild.id ? role.name : 'ONTBREEKT/ONGELDIG'}`);}
    for (const [key,channel] of Object.entries(c.channels)) {
      if (!channel) { lines.push(`${key}: niet ingesteld`); continue; }
      try { await writable(guild,channel,{privateStaff:key==='staffWarnings',c}); lines.push(`${key}: bereikbaar`); } catch(e) { lines.push(`${key}: ${e.message}`); }
    }
    for (const rank of c.roles.ranks) { const role=await guild.roles.fetch(rank.roleId); lines.push(`Rank ${rank.name}: ${role && !role.managed && me.roles.highest.comparePositionTo(role)>0 ? 'toewijsbaar' : 'NIET toewijsbaar'}`); }
    return lines.join('\n');
  }
}
