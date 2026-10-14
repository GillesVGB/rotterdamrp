import { redact } from './logging.js';
import { refreshApplicationEmojis } from '../utils/application-emojis.js';
export class Scheduler {
  constructor(ctx) { this.ctx=ctx; this.running=false; this.stopping=false; this.lastCleanup=0; this.lastEmojiRefresh=Date.now(); }
  start() { this.timer=setInterval(()=>{void this.tick().catch(e=>console.error(`Scheduler: ${redact(e.message,this.ctx.env)}`));},10000); return this.tick(); }
  async stop() { this.stopping=true; clearInterval(this.timer); while(this.running) await new Promise(resolve=>setTimeout(resolve,50)); }
  async bans() {
    const {store,client,logger}=this.ctx, now=Date.now();
    for (const row of store.all("SELECT * FROM sanctions WHERE kind='ban' AND active=1 AND retry_at<=? AND (state='pending' OR (expires_at IS NOT NULL AND expires_at<=?))",now,now)) await this.ctx.mutex.run(`member:${row.user_id}`,async()=>{
      const s=store.get('SELECT * FROM sanctions WHERE id=? AND active=1',row.id);
      if(!s || (s.state!=='pending' && (s.expires_at===null || s.expires_at>now))) return;
      const guild=await client.guilds.fetch(s.guild_id);
      try {
        let ban;
        try { ban=await guild.bans.fetch(s.user_id); }
        catch(e) { if(e.code!==10026) throw e; }
        if (!ban) {
          store.run("UPDATE sanctions SET active=0,state=? WHERE id=?",s.state==='pending' ? 'not-confirmed' : 'expired',s.id); return;
        }
        if (!ban.reason?.startsWith(`RLRP:${s.token} |`)) {
          store.run("UPDATE sanctions SET active=0,state='superseded' WHERE id=?",s.id);
          await logger.log(guild,'moderation','Tijdelijke ban overschreven',{target:s.user_id,reason:`Sanctie #${s.id}`,result:'Huidige ban heeft een andere referentie; niet automatisch opgeheven.'}); return;
        }
        if (s.state==='pending') store.run("UPDATE sanctions SET state='applied' WHERE id=?",s.id);
        if (s.expires_at!==null && s.expires_at<=now) {
          await guild.members.unban(s.user_id,`RLRP tijdelijke ban #${s.id} verlopen`);
          store.run("UPDATE sanctions SET active=0,state='expired' WHERE id=?",s.id);
          await logger.log(guild,'moderation','Tijdelijke ban verlopen',{target:s.user_id,reason:`Sanctie #${s.id}`,result:'Automatisch opgeheven'});
        }
      } catch(e) { store.run('UPDATE sanctions SET retry_at=? WHERE id=?',now+60000,s.id); await logger.error(guild,`Banherstel #${s.id}`,e); }
    });
    store.run("UPDATE sanctions SET active=0 WHERE active=1 AND expires_at IS NOT NULL AND expires_at<=? AND kind IN ('timeout','auto-spam','auto-mentions')",now);
  }
  async tick() {
    if(this.running || this.stopping || !this.ctx.client.isReady()) return;
    this.running=true;
    const {store,client,logger}=this.ctx;
    try {
      const guild=await client.guilds.fetch(this.ctx.env.guildId);
      // Elke module heeft een eigen foutgrens: één kapot endpoint blokkeert geen banverloop.
      const task=async(label,fn)=>{try{await fn();}catch(e){await logger.error(guild,label,e);}};
      await task('Tijdelijke bans verwerken',()=>this.bans());
      for(const g of store.all("SELECT id FROM giveaways WHERE state IN ('active','closing') AND ends_at<=?",Date.now())) await task(`Giveaway ${g.id}`,()=>this.ctx.mutex.run(`draw:${g.id}`,()=>this.ctx.giveaways.finish(g.id)));
      await task('Evenementen verwerken',()=>this.ctx.mutex.run('events:tick',()=>this.ctx.events.tick(guild)));
      await task('FiveM-status verversen',()=>this.ctx.fivem.poll(guild));
      if(Date.now()-this.lastEmojiRefresh>300000) {this.lastEmojiRefresh=Date.now();await task('Applicatie-emoji verversen',()=>refreshApplicationEmojis(this.ctx,guild));}
      await task('Verzendwachtrij verwerken',()=>this.ctx.outbox.flush());
      if(Date.now()-this.lastCleanup>3600000) {
        this.lastCleanup=Date.now(); const c=store.config(guild.id),cutoff=Date.now()-c.logging.retentionDays*86400000;
        store.transaction(()=>{
          store.run('DELETE FROM hits WHERE created_at<?',Date.now()-600000);
          store.run('DELETE FROM audit_seen WHERE created_at<?',Date.now()-86400000);
          store.run('DELETE FROM logs WHERE created_at<?',cutoff);
          store.run('DELETE FROM incidents WHERE created_at<?',cutoff);
          store.run("DELETE FROM outbox WHERE state='sent' AND created_at<? AND id NOT LIKE 'fivem:%'",cutoff);
          store.run('DELETE FROM sessions WHERE expires_at<?',Date.now()); store.run('DELETE FROM views WHERE expires_at<?',Date.now());
        });
      }
    } finally { this.running=false; }
  }
}
