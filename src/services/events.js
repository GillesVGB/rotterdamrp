import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildScheduledEventEntityType as Type, GuildScheduledEventPrivacyLevel as Privacy, GuildScheduledEventStatus as Status, PermissionFlagsBits as P } from 'discord.js';
import { duration, future, text, UserError } from '../utils/validation.js';
import { payload } from '../utils/embeds.js';
import { writable, botPermissions } from '../security/permissions.js';
import { mutate } from './logging.js';
import { showView } from './views.js';
export class EventService {
  constructor(ctx) { this.ctx = ctx; }
  data(guild,c,e) {
    const n = this.ctx.store.get('SELECT COUNT(*) AS n FROM event_entries WHERE event_id=?',e.id).n;
    return {...payload(guild,c,e.name,`${e.description}\n\nLocatie: ${e.location}\nStart: <t:${Math.floor(e.starts_at/1000)}:F>\nEinde: <t:${Math.floor(e.ends_at/1000)}:t>\nAanmeldingen: ${n}/${e.capacity}\nStatus: ${e.state}\nID: \`${e.id}\`${e.discord_id ? `\n[Discord-evenement](https://discord.com/events/${guild.id}/${e.discord_id})` : ''}`),components:e.state==='scheduled' ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`event:join:${e.id}`).setLabel('Aanmelden').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId(`event:leave:${e.id}`).setLabel('Afmelden').setStyle(ButtonStyle.Secondary)).toJSON()] : []};
  }
  async execute(i,actor,c) {
    const { store,logger } = this.ctx, sub = i.options.getSubcommand();
    if (sub === 'lijst') {
      const rows = store.all("SELECT * FROM events WHERE guild_id=? AND state IN ('scheduled','active') ORDER BY starts_at",i.guildId);
      return showView(this.ctx,i,'Evenementen',rows.map(e=>`${e.name} • <t:${Math.floor(e.starts_at/1000)}:F> • ${e.state}\nID: \`${e.id}\``).join('\n\n'));
    }
    if (sub === 'maken') {
      await botPermissions(i.guild,[P.CreateEvents,P.ManageEvents]);
      const channel = await writable(i.guild,i.options.getChannel('kanaal').id), key = randomUUID(), start = future(i.options.getString('start'));
      const e = {id:key,guild_id:i.guildId,channel_id:channel.id,actor:i.user.id,name:text(i.options.getString('naam'),100),description:text(i.options.getString('beschrijving'),1000),location:text(i.options.getString('locatie'),100),starts_at:start,ends_at:start+duration(i.options.getString('duur'),7*86400000),capacity:i.options.getInteger('capaciteit'),state:'creating'};
      store.run('INSERT INTO events(id,guild_id,channel_id,actor,name,description,location,starts_at,ends_at,capacity,state,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',key,i.guildId,channel.id,i.user.id,e.name,e.description,e.location,e.starts_at,e.ends_at,e.capacity,'creating',Date.now());
      await mutate(this.ctx,i,'evenement.maken',null,{event:key},()=>i.guild.scheduledEvents.create({name:e.name,description:`${e.description}\nRLRP:${key}`,scheduledStartTime:e.starts_at,scheduledEndTime:e.ends_at,privacyLevel:Privacy.GuildOnly,entityType:Type.External,entityMetadata:{location:e.location},reason:`RLRP door ${i.user.id}`}),created=>{
        store.run("UPDATE events SET discord_id=?,state='scheduled' WHERE id=?",created.id,key);
        e.discord_id=created.id; e.state='scheduled'; store.queue(i.guildId,channel.id,this.data(i.guild,c,e),`event:${key}`);
      });
      await logger.log(i.guild,'system','Evenement gemaakt',{actor:i.user.id,reason:key});
      return i.editReply(payload(i.guild,c,'Evenement gemaakt',`ID: \`${key}\`\nDiscord Scheduled Event en persistente RSVP zijn opgeslagen.`));
    }
    const e = store.get('SELECT * FROM events WHERE id=? AND guild_id=?',i.options.getString('id'),i.guildId);
    if (!e) throw new UserError('Evenement niet gevonden.');
    if (sub === 'deelnemers') {
      const rows = store.all('SELECT * FROM event_entries WHERE event_id=? ORDER BY created_at',e.id);
      return showView(this.ctx,i,`Deelnemers • ${e.name}`,rows.map(r=>`<@${r.user_id}> • <t:${Math.floor(r.created_at/1000)}:f>`).join('\n'),'evenement.deelnemers');
    }
    if (e.state !== 'scheduled') throw new UserError('Alleen geplande evenementen kunnen worden geannuleerd.');
    await botPermissions(i.guild,[P.ManageEvents]);
    const discordEvent = await i.guild.scheduledEvents.fetch(e.discord_id);
    await mutate(this.ctx,i,'evenement.annuleren',null,{event:e.id},()=>discordEvent.setStatus(Status.Canceled,`RLRP annulering ${i.user.id}`),()=>{
      store.run("UPDATE events SET state='canceled' WHERE id=?",e.id);
      store.queue(i.guildId,e.channel_id,payload(i.guild,c,'Evenement geannuleerd',e.name),`cancel:${e.id}`);
    });
    await this.update(e.id); await logger.log(i.guild,'system','Evenement geannuleerd',{actor:i.user.id,reason:e.id});
    return i.editReply(payload(i.guild,c,'Evenement geannuleerd',e.name));
  }
  async button(i,action,key) {
    const { store } = this.ctx, e = store.get('SELECT * FROM events WHERE id=? AND guild_id=?',key,i.guildId);
    if (!e || i.user.bot) throw new UserError('Geen geldig evenement of gebruiker.');
    await i.guild.members.fetch(i.user.id);
    if (action === 'join') {
      const added = store.joinEvent(key,i.user.id);
      await i.editReply({content:added ? 'Je aanmelding is opgeslagen.' : 'Je was al aangemeld.'});
    } else if (action === 'leave') {
      if (e.starts_at<=Date.now() || e.state!=='scheduled') throw new UserError('Dit evenement is al gestart of gesloten.');
      store.run('DELETE FROM event_entries WHERE event_id=? AND user_id=?',key,i.user.id);
      await i.editReply({content:'Je bent afgemeld.'});
    } else throw new UserError('Ongeldige evenementactie.');
    await this.update(key);
  }
  async update(key) {
    const e = this.ctx.store.get('SELECT * FROM events WHERE id=?',key);
    if (!e.message_id) return;
    try { const g=await this.ctx.client.guilds.fetch(e.guild_id),ch=await g.channels.fetch(e.channel_id); await ch.messages.edit(e.message_id,this.data(g,this.ctx.store.config(g.id),e)); }
    catch(err) { await this.ctx.logger.error(await this.ctx.client.guilds.fetch(e.guild_id),'Evenementbericht bijwerken mislukt',err); }
  }
  async tick(guild) {
    const { store } = this.ctx, c = store.config(guild.id), now = Date.now();
    // Herstel een crash tussen Discord-create en SQL-commit op een unieke projectreferentie.
    const creating = store.all("SELECT * FROM events WHERE guild_id=? AND state='creating'",guild.id);
    if (creating.length) {
      const discordEvents = await guild.scheduledEvents.fetch();
      for (const e of creating) {
        const found = discordEvents.find(x=>x.creatorId===this.ctx.client.user.id && x.description?.endsWith(`RLRP:${e.id}`));
        if (found) store.transaction(()=>{ store.run("UPDATE events SET discord_id=?,state='scheduled' WHERE id=?",found.id,e.id); store.queue(guild.id,e.channel_id,this.data(guild,c,{...e,discord_id:found.id,state:'scheduled'}),`event:${e.id}`); });
        else if (now-e.created_at>60000) { store.run("UPDATE events SET state='failed' WHERE id=?",e.id); await this.ctx.logger.log(guild,'system','Evenementcreate niet bevestigd',{reason:e.id,result:'failed; controleer /systeem acties'}); }
      }
    }
    for (const e of store.all("SELECT * FROM events WHERE guild_id=? AND state IN ('scheduled','active')",guild.id)) {
      const event = await guild.scheduledEvents.fetch(e.discord_id).catch(err=>{ if (err.code===10070) return null; throw err; });
      if (!event || event.status === Status.Canceled || event.status === Status.Completed) {
        store.run('UPDATE events SET state=? WHERE id=?',event?.status === Status.Completed ? 'ended' : 'canceled',e.id); await this.update(e.id); continue;
      }
      if (e.state==='scheduled' && !e.reminder_sent && e.starts_at-now<=15*60000 && e.starts_at>now) store.transaction(()=>{
        store.queue(guild.id,e.channel_id,payload(guild,c,'Evenement begint binnenkort',`${e.name}\n<t:${Math.floor(e.starts_at/1000)}:R> • ${e.location}`),`reminder:${e.id}`);
        store.run('UPDATE events SET reminder_sent=1 WHERE id=?',e.id);
      });
      if (e.ends_at<=now) {
        if (event.status===Status.Scheduled) {
          await event.setStatus(Status.Canceled); store.run("UPDATE events SET state='missed' WHERE id=?",e.id);
          await this.ctx.logger.log(guild,'system','Evenementvenster gemist',{reason:e.id,result:'Start en eindtijd verstreken; gepland Discord-event geannuleerd, geen fictieve uitvoering.'});
        } else {
          if (event.status===Status.Active) await event.setStatus(Status.Completed);
          store.run("UPDATE events SET state='ended' WHERE id=?",e.id);
        }
        await this.update(e.id);
      } else if (e.starts_at<=now && e.state==='scheduled') {
        if (event.status===Status.Scheduled) await event.setStatus(Status.Active);
        store.run("UPDATE events SET state='active' WHERE id=?",e.id); await this.update(e.id);
      }
    }
  }
}
