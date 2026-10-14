import { createHash, randomUUID } from 'node:crypto';
import { AttachmentBuilder } from 'discord.js';
import { fileURLToPath } from 'node:url';
import { payload, NO_MENTIONS } from '../utils/embeds.js';
import { truncate } from '../utils/validation.js';

export function redact(value, env) {
  let out = String(value || 'Onbekende fout');
  if (env.token) out = out.replaceAll(env.token, '[secret]');
  return out.replace(/https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\S+/gi, '[webhook-secret]').slice(0, 1000);
}
export class Logger {
  constructor(ctx) { this.ctx = ctx; }
  async log(guild, category, action, { actor = null, target = null, reason = '', result = 'geslaagd' } = {}) {
    const { store, env } = this.ctx;
    reason = reason ? redact(reason, env) : ''; result = redact(result, env);
    store.run('INSERT INTO logs(guild_id,category,actor,target,action,reason,result,created_at) VALUES (?,?,?,?,?,?,?,?)', guild.id, category, actor, target, action, reason, result, Date.now());
    const c = store.config(guild.id), channel = c.channels[category];
    if (channel) store.queue(guild.id, channel, payload(guild, c, action, `Uitvoerder: ${actor ? `<@${actor}>` : 'Systeem / onbekend'}\nDoelwit: ${target ? `<@${target}>` : '—'}\nReden: ${truncate(reason, 800) || '—'}\nResultaat: ${truncate(result, 800)}`));
    else if (category==='system') console.warn(`[${category}] ${action}: ${result}`);
  }
  async error(guild, label, error) {
    console.error(`${label}: ${redact(error.message, this.ctx.env)}`);
    if (guild) await this.log(guild, 'system', label, { result: redact(error.message, this.ctx.env) });
  }
}
export class Outbox {
  constructor(ctx) { this.ctx = ctx; }
  async flush() {
    const { store, client } = this.ctx;
    for (const item of store.all("SELECT * FROM outbox WHERE state='pending' AND next_at<=? ORDER BY created_at LIMIT 20", Date.now())) {
      try {
        const guild = await client.guilds.fetch(item.guild_id), channel = await guild.channels.fetch(item.channel_id);
        if (!channel?.isTextBased()) throw new Error('Outboxkanaal ontbreekt of is geen tekstkanaal.');
        let data = JSON.parse(item.payload);
        const reference = `RLRP:${item.id}`;
        // Discord nonce blijft onzichtbaar in embeds en helpt een send na timeout
        // terug te vinden. De legacy-marker vangt berichten van oude versies op.
        const nonce = createHash('sha256').update(`${guild.id}:${item.id}`).digest('hex').slice(0,25);
        if(item.id.startsWith('giveaway:')) {
          const giveaway=store.get('SELECT * FROM giveaways WHERE id=?',item.id.slice(9));
          if(giveaway) data=this.ctx.giveaways.data(guild,store.config(guild.id),giveaway);
        }
        if(item.id.startsWith('event:')) {
          const event=store.get('SELECT * FROM events WHERE id=?',item.id.slice(6));
          if(event) data=this.ctx.events.data(guild,store.config(guild.id),event);
        }
        const reaction = data.reaction; delete data.reaction;
        if(data.brandAsset==='banner') {data.files=[new AttachmentBuilder(fileURLToPath(new URL('../../assets/rlrp-banner.png',import.meta.url)),{name:'rlrp-banner.png'})];}
        delete data.brandAsset;
        const messages = item.attempts > 0 ? await channel.messages.fetch({ limit: 100 }) : null;
        let message = messages?.find(m => m.author.id === client.user.id && (String(m.nonce) === nonce || m.embeds.some(e => e.footer?.text?.includes(reference)) || m.content.endsWith(`\n-# ${reference}`)));
        if (!message) {
          // Markeer vóór het REST-verzoek, zodat een crash na verzending maar
          // vóór de SQL-commit bij herstart ook eerst op de nonce kan zoeken.
          if (item.attempts === 0) store.run('UPDATE outbox SET attempts=1 WHERE id=? AND attempts=0',item.id);
          message = await channel.send({ ...data, nonce, enforceNonce: true, allowedMentions: NO_MENTIONS });
        }
        store.transaction(()=>{
          store.run("UPDATE outbox SET state='sent',message_id=?,error=NULL WHERE id=?", message.id, item.id);
          if (item.id.startsWith('giveaway:')) store.run('UPDATE giveaways SET message_id=?,commitment_published=1 WHERE id=? AND round=1', message.id, item.id.slice(9));
          if (item.id.startsWith('round:')) {const [,key,round]=item.id.split(':');store.run('UPDATE giveaways SET commitment_published=1 WHERE id=? AND round=?',key,Number(round));}
          if (item.id.startsWith('event:')) store.run('UPDATE events SET message_id=? WHERE id=?', message.id, item.id.slice(6));
          if (item.id.startsWith('fivem:')) store.run("INSERT INTO managed_messages VALUES (?,'fivem',?,?) ON CONFLICT(guild_id,kind) DO UPDATE SET channel_id=excluded.channel_id,message_id=excluded.message_id",guild.id,channel.id,message.id);
        });
        if (reaction) { try { await message.react(reaction); } catch (e) { await this.ctx.logger.error(guild, 'Logo-reactie mislukt', e); } }
      } catch (e) {
        const attempts = item.attempts + 1;
        store.run('UPDATE outbox SET attempts=?,next_at=?,error=? WHERE id=?', attempts, Date.now() + Math.min(3600000, 5000 * 2 ** Math.min(attempts, 9)), redact(e.message, this.ctx.env), item.id);
        console.error(`Outbox ${item.id}: ${redact(e.message, this.ctx.env)}`);
      }
    }
  }
}
export async function mutate(ctx, i, kind, target, details, work, commit) {
  const action = ctx.store.begin(i.guildId, i.user.id, target, kind, details);
  try {
    const result = await work(action);
    ctx.store.transaction(() => { commit?.(result, action); ctx.store.finish(action); });
    return result;
  } catch (e) {
    // Zelfs een netwerkfout kan ná de REST-mutatie plaatsvinden. Niet blind retryen.
    ctx.store.finish(action, 'uncertain', redact(e.message, ctx.env));
    await ctx.logger.log(i.guild, 'system', 'Actie onderbroken: controle vereist', { actor: i.user.id, target, reason: kind, result: `Referentie ${action}: ${redact(e.message, ctx.env)}` });
    throw e;
  }
}
export async function dm(ctx, guild, user, data) {
  try { await user.send({ ...data, allowedMentions: NO_MENTIONS }); return true; }
  catch (e) { await ctx.logger.log(guild, 'system', 'Privébericht niet bezorgd', { target: user.id, result: redact(e.message, ctx.env) }); return false; }
}
export const newId = () => randomUUID();
