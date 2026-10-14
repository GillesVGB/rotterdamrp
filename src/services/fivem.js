import { UserError, truncate } from '../utils/validation.js';
import { payload } from '../utils/embeds.js';
import { showView } from './views.js';
export async function boundedJson(endpoint, fetcher = fetch) {
  const response = await fetcher(endpoint,{signal:AbortSignal.timeout(5000),redirect:'error',headers:{Accept:'application/json'}});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const reader = response.body.getReader(), chunks = []; let total = 0;
  try {
    for (;;) { const {done,value} = await reader.read(); if (done) break; total += value.length; if (total>1024*1024) throw new Error('Response te groot.'); chunks.push(value); }
  } finally { await reader.cancel().catch(()=>{}); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export class FiveMService {
  constructor(ctx, fetcher = fetch) { this.ctx = ctx; this.fetcher = fetcher; this.cache = null; this.lastPoll = 0; }
  async status(force = false) {
    if (!this.ctx.env.fivemUrl) throw new UserError('FIVEM_BASE_URL is niet ingesteld in .env.');
    if (!force && this.cache && Date.now()-this.cache.checkedAt<15000) return this.cache;
    const [dynamic,info,players] = await Promise.allSettled(['dynamic.json','info.json','players.json'].map(x=>boundedJson(`${this.ctx.env.fivemUrl}/${x}`,this.fetcher)));
    const number = v => { const n = Number(v); return Number.isInteger(n) && n>=0 && n<=10000 ? n : null; };
    const d = dynamic.status === 'fulfilled' && dynamic.value && !Array.isArray(dynamic.value) ? dynamic.value : null;
    const meta = info.status === 'fulfilled' && info.value && !Array.isArray(info.value) ? info.value : null;
    // Alleen naam en server-ID blijven in geheugen. Geen identifiers, IP's of licenses.
    const list = players.status === 'fulfilled' && Array.isArray(players.value) ? players.value.slice(0,10000).filter(p=>p && typeof p.name==='string' && number(p.id)!==null).map(p=>({id:number(p.id),name:truncate(p.name,80)})) : null;
    this.cache = { reachable:!!(d || meta),name:truncate(d?.hostname || meta?.vars?.sv_projectName || 'Rotterdam Roleplay',100),count:number(d?.clients) ?? list?.length ?? null,max:number(d?.sv_maxclients ?? meta?.vars?.sv_maxClients),players:list,checkedAt:Date.now() };
    return this.cache;
  }
  data(guild,c,s) {
    return payload(guild,c,'FiveM-serverstatus',`${s.reachable ? '🟢 Endpoint bereikbaar' : '🔴 Endpoint onbereikbaar'}\n${s.reachable ? `${s.name}\nSpelers: ${s.count ?? 'onbekend'} / ${s.max ?? '?'}` : 'De bot kan de HTTP-status niet ophalen. Dit bewijst niet dat de gameserver offline is.'}\nGecontroleerd <t:${Math.floor(s.checkedAt/1000)}:R>${this.ctx.env.joinUrl ? `\n[Verbinden](${this.ctx.env.joinUrl})` : ''}`);
  }
  async execute(i,actor,c) {
    const s = await this.status();
    if (i.options.getSubcommand() === 'spelers') {
      if (!c.fivem.showPlayers) throw new UserError('Spelersnamen publiceren is niet ingeschakeld door de serverbeheerder.');
      if (!s.players) throw new UserError('De spelerslijst is niet beschikbaar; het endpoint kan afgeschermd zijn.');
      return showView(this.ctx,i,'FiveM-spelers',s.players.map(p=>`#${p.id} • ${p.name.replace(/[`*_<>@]/g,'')}`).join('\n'));
    }
    return i.editReply(this.data(i.guild,c,s));
  }
  async poll(guild) {
    const { store } = this.ctx, c = store.config(guild.id);
    if (!this.ctx.env.fivemUrl || !c.channels.fivem || Date.now()-this.lastPoll<c.fivem.pollSeconds*1000) return;
    this.lastPoll = Date.now();
    const s = await this.status(true), data = this.data(guild,c,s);
    const row = store.get("SELECT * FROM managed_messages WHERE guild_id=? AND kind='fivem'",guild.id);
    if (row && row.channel_id === c.channels.fivem) {
      try { const ch = await guild.channels.fetch(row.channel_id); await ch.messages.edit(row.message_id,data); return; }
      catch(e) {
        if (e.code !== 10008 && e.code !== 10003) throw e;
        store.run("DELETE FROM managed_messages WHERE guild_id=? AND kind='fivem'",guild.id);
        store.run('DELETE FROM outbox WHERE id=?',`fivem:${guild.id}:${c.channels.fivem}`);
      }
    }
    store.queue(guild.id,c.channels.fivem,data,`fivem:${guild.id}:${c.channels.fivem}`);
  }
}
