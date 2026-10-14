import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { UserError, text, pages } from '../utils/validation.js';
import { payload } from '../utils/embeds.js';
import { writable } from '../security/permissions.js';
import { showView } from './views.js';
export class DocumentService {
  constructor(ctx) { this.ctx = ctx; }
  async execute(i,actor,c) {
    const { store,logger } = this.ctx, kind = i.commandName, sub = i.options.getSubcommand();
    if (sub === 'toevoegen') {
      const version = store.transaction(() => {
        const v = store.get('SELECT COALESCE(MAX(version),0)+1 AS n FROM documents WHERE guild_id=? AND kind=?',i.guildId,kind).n;
        store.run('INSERT INTO documents(guild_id,kind,version,title,content,actor,created_at) VALUES (?,?,?,?,?,?,?)',i.guildId,kind,v,text(i.options.getString('titel'),200),text(i.options.getString('inhoud'),6000),i.user.id,Date.now());
        return v;
      });
      await logger.log(i.guild,'system',`${kind} versie toegevoegd`,{actor:i.user.id,reason:`Versie ${version}`});
      return i.editReply(payload(i.guild,c,'Document opgeslagen',`${kind.toUpperCase()} versie ${version}. Publiceer met /${kind} publiceren.`));
    }
    const version = i.options.getInteger('versie');
    const doc = version ? store.get('SELECT * FROM documents WHERE guild_id=? AND kind=? AND version=?',i.guildId,kind,version) : store.get('SELECT * FROM documents WHERE guild_id=? AND kind=? AND published=1 ORDER BY version DESC LIMIT 1',i.guildId,kind);
    if (!doc || (['bekijken','accepteren'].includes(sub) && !doc.published)) throw new UserError('Geen gepubliceerde versie gevonden. De serverbeheerder moet eigen geldige inhoud invoeren.');
    if (sub === 'bekijken') return showView(this.ctx,i,`${doc.title} • v${doc.version}`,doc.content);
    if (sub === 'accepteren') {
      const added = this.accept(doc,i.user.id);
      return i.editReply(payload(i.guild,c,'Acceptatie vastgelegd',`${kind.toUpperCase()} v${doc.version}${added ? ' geaccepteerd.' : ' had je al geaccepteerd.'}`));
    }
    if (sub === 'acceptaties') {
      const rows = store.all('SELECT * FROM acceptances WHERE document_id=? ORDER BY created_at DESC',doc.id);
      return showView(this.ctx,i,`Acceptaties • ${kind} v${doc.version}`,rows.map(r=>`<@${r.user_id}> • <t:${Math.floor(r.created_at/1000)}:f>`).join('\n'),`${kind}.acceptaties`);
    }
    const channel = await writable(i.guild,c.channels.rules), chunks = pages(doc.content,3300);
    store.transaction(() => {
      store.run('UPDATE documents SET published=1 WHERE id=?',doc.id);
      chunks.forEach((chunk,index)=>store.queue(i.guildId,channel.id,{...payload(i.guild,c,`${doc.title} • v${doc.version}`,chunk,{footer:`${kind.toUpperCase()} • Pagina ${index+1}/${chunks.length}`}),components:index===chunks.length-1 ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`accept:${doc.id}`).setLabel(`Accepteer ${kind} v${doc.version}`).setStyle(ButtonStyle.Success)).toJSON()] : []},`doc:${doc.id}:${index}`));
    });
    await logger.log(i.guild,'system',`${kind} gepubliceerd`,{actor:i.user.id,reason:`Versie ${doc.version}`});
    return i.editReply(payload(i.guild,c,'Publicatie ingepland',`${chunks.length} pagina's, met een versiegebonden acceptatieknop.`));
  }
  accept(doc,userId) {
    if (!doc.published) throw new UserError('Deze versie is niet gepubliceerd.');
    return !!this.ctx.store.run('INSERT OR IGNORE INTO acceptances VALUES (?,?,?)',doc.id,userId,Date.now()).changes;
  }
  async button(i,key) {
    const doc = this.ctx.store.get('SELECT * FROM documents WHERE id=? AND guild_id=?',Number(key),i.guildId);
    if (!doc) throw new UserError('Document bestaat niet.');
    await i.guild.members.fetch(i.user.id);
    const added = this.accept(doc,i.user.id);
    return i.editReply({content:added ? `${doc.kind.toUpperCase()} v${doc.version} geaccepteerd.` : 'Deze versie had je al geaccepteerd.'});
  }
}
