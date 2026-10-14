import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import { UserError, duration, text } from '../utils/validation.js';
import { payload } from '../utils/embeds.js';
import { writable } from '../security/permissions.js';
export const commitment = seed => createHash('sha256').update(seed).digest('hex');
export function draw(seed, entrants, count) {
  if (new Set(entrants).size !== entrants.length) throw new Error('Dubbele deelnemers in trekking.');
  if (entrants.length < count) return [];
  return entrants.map(user=>({user,score:commitment(`${seed}:${user}`)})).sort((a,b)=>a.score.localeCompare(b.score,'en') || a.user.localeCompare(b.user,'en')).slice(0,count).map(x=>x.user);
}
const buttons = id => [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`giveaway:${id}`).setLabel('🎉 Deelnemen').setStyle(ButtonStyle.Success)).toJSON()];
export class GiveawayService {
  constructor(ctx) { this.ctx = ctx; }
  data(guild,c,g) {
    return { ...payload(guild,c,`Giveaway • ${g.prize}`,`ID: \`${g.id}\` • Ronde ${g.round}\nWinnaars: ${g.winner_count}\nEinde: <t:${Math.floor(g.ends_at/1000)}:R>\nStatus: ${g.state}\nVoorwaarden: ${g.conditions || 'Lid van deze server; geen bots.'}\n\nCommitment (SHA-256):\n\`${g.commitment}\``), components: g.state === 'active' ? buttons(g.id) : [] };
  }
  async execute(i,actor,c) {
    const { store,logger } = this.ctx;
    if (i.commandName === 'giveaway') {
      const channel = await writable(i.guild,i.options.getChannel('kanaal').id);
      const key = randomUUID(), seed = randomBytes(32).toString('hex'), end = Date.now()+duration(i.options.getString('duur'));
      const g = {id:key,guild_id:i.guildId,channel_id:channel.id,actor:i.user.id,prize:text(i.options.getString('prijs'),200),conditions:text(i.options.getString('voorwaarden') || '',1000,0),winner_count:i.options.getInteger('winnaars'),ends_at:end,state:'active',seed,commitment:commitment(seed),round:1};
      store.transaction(() => {
        store.run('INSERT INTO giveaways(id,guild_id,channel_id,actor,prize,conditions,winner_count,ends_at,seed,commitment,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',key,i.guildId,channel.id,i.user.id,g.prize,g.conditions,g.winner_count,end,seed,g.commitment,Date.now());
        store.queue(i.guildId,channel.id,this.data(i.guild,c,g),`giveaway:${key}`);
      });
      await logger.log(i.guild,'system','Giveaway gestart',{actor:i.user.id,reason:key});
      return i.editReply(payload(i.guild,c,'Giveaway opgeslagen',`ID: \`${key}\`\nDe publicatie staat in de verzendwachtrij.`));
    }
    const g = store.get('SELECT * FROM giveaways WHERE id=? AND guild_id=?',i.options.getString('id'),i.guildId);
    if (!g) throw new UserError('Giveaway niet gevonden.');
    const sub = i.options.getSubcommand();
    if (sub === 'status') return i.editReply(this.data(i.guild,c,g));
    if (sub === 'bewijs') {
      const rounds = store.all('SELECT * FROM giveaway_draws WHERE giveaway_id=? ORDER BY round',g.id).map(r=>({...r,entrants:JSON.parse(r.entrants),winners:JSON.parse(r.winners),excluded:JSON.parse(r.excluded)}));
      if (!rounds.length) throw new UserError('Er is nog geen afgeronde trekking; de seed blijft geheim tot afsluiting.');
      const proof = {algorithm:'SHA256(seed + ":" + DiscordUserId); sort ascending hex; first winner_count; empty if insufficient',giveaway:g.id,winner_count:g.winner_count,rounds};
      return i.editReply({ ...payload(i.guild,c,'Trekkingbewijs',`Alle afgeronde rondes, seeds, commitments en geldige deelnemerlijsten staan in de bijlage.`),files:[new AttachmentBuilder(Buffer.from(JSON.stringify(proof,null,2)),{name:`giveaway-${g.id}.json`})] });
    }
    if (sub === 'eindigen') {
      if (!['active','closing'].includes(g.state)) throw new UserError('Deze giveaway is al afgesloten.');
      store.run("UPDATE giveaways SET ends_at=? WHERE id=?",Date.now(),g.id);
      await this.finish(g.id);
    } else {
      if (g.state !== 'ended') throw new UserError('Sluit eerst de huidige ronde af.');
      const seed = randomBytes(32).toString('hex'), end = Date.now()+(sub === 'reroll' ? 30000 : duration(i.options.getString('duur')));
      await writable(i.guild,g.channel_id);
      store.transaction(() => {
        store.run("UPDATE giveaways SET state='active',seed=?,commitment=?,round=round+1,ends_at=?,mode=?,commitment_published=0 WHERE id=?",seed,commitment(seed),end,sub === 'reroll' ? 'reroll' : 'normal',g.id);
        if (sub === 'opnieuw') store.run('DELETE FROM giveaway_entries WHERE giveaway_id=?',g.id);
        const updated = store.get('SELECT * FROM giveaways WHERE id=?',g.id);
        store.queue(i.guildId,g.channel_id,this.data(i.guild,c,updated),`round:${g.id}:${updated.round}`);
      });
      await this.updateMessage(g.id);
    }
    await logger.log(i.guild,'system',`Giveaway ${sub}`,{actor:i.user.id,reason:g.id});
    return i.editReply(payload(i.guild,c,'Giveaway verwerkt',`ID: \`${g.id}\``));
  }
  async join(i,key) {
    const g = this.ctx.store.get('SELECT * FROM giveaways WHERE id=? AND guild_id=?',key,i.guildId);
    if (!g || i.user.bot) throw new UserError('Geen geldige giveaway of deelnemer.');
    await i.guild.members.fetch(i.user.id);
    if (g.mode === 'reroll') throw new UserError('Een reroll gebruikt de bestaande deelnemerlijst; nieuwe deelname is gesloten.');
    const added = this.ctx.store.joinGiveaway(key,i.user.id);
    return i.editReply({content:added ? 'Je deelname is opgeslagen.' : 'Je doet al mee.'});
  }
  async finish(key) {
    const { store,client } = this.ctx;
    let g = store.get('SELECT * FROM giveaways WHERE id=?',key);
    if (!g || !['active','closing'].includes(g.state) || g.ends_at > Date.now() || !g.commitment_published) return;
    store.run("UPDATE giveaways SET state='closing' WHERE id=?",key);
    g = store.get('SELECT * FROM giveaways WHERE id=?',key);
    const guild = await client.guilds.fetch(g.guild_id), c = store.config(g.guild_id);
    const excluded = g.mode === 'reroll' ? [...new Set(store.all('SELECT winners FROM giveaway_draws WHERE giveaway_id=?',key).flatMap(r=>JSON.parse(r.winners)))] : [];
    const entrants = [];
    for (const row of store.all('SELECT user_id FROM giveaway_entries WHERE giveaway_id=? ORDER BY user_id',key)) {
      if (excluded.includes(row.user_id)) continue;
      try { const m = await guild.members.fetch({user:row.user_id,force:true}); if (!m.user.bot) entrants.push(row.user_id); }
      catch(e) { if (e.code !== 10007) throw e; } // API/netwerkfouten zijn geen bewijs dat iemand is vertrokken.
    }
    const winners = draw(g.seed,entrants,g.winner_count);
    store.transaction(() => {
      store.run('INSERT OR IGNORE INTO giveaway_draws VALUES (?,?,?,?,?,?,?,?)',key,g.round,g.seed,g.commitment,JSON.stringify(entrants),JSON.stringify(winners),JSON.stringify(excluded),Date.now());
      store.run("UPDATE giveaways SET state='ended' WHERE id=?",key);
      store.queue(g.guild_id,g.channel_id,payload(guild,c,`Giveaway afgelopen • ${g.prize}`,`${winners.length ? `Winnaars: ${winners.map(x=>`<@${x}>`).join(', ')}` : `Geen winnaars: ${entrants.length} geldige deelnemers voor ${g.winner_count} prijzen.`}\nID: \`${key}\` • Ronde ${g.round}\nSeed: \`${g.seed}\`\nCommitment: \`${g.commitment}\`\nBekijk /giveawaybeheer bewijs voor de volledige snapshot.`),`draw:${key}:${g.round}`);
    });
    await this.updateMessage(key);
  }
  async updateMessage(key) {
    const g = this.ctx.store.get('SELECT * FROM giveaways WHERE id=?',key);
    if (!g.message_id) return;
    try {
      const guild = await this.ctx.client.guilds.fetch(g.guild_id), channel = await guild.channels.fetch(g.channel_id);
      await channel.messages.edit(g.message_id,this.data(guild,this.ctx.store.config(g.guild_id),g));
    } catch(e) { await this.ctx.logger.error(await this.ctx.client.guilds.fetch(g.guild_id),'Giveawaybericht bijwerken mislukt',e); }
  }
}
