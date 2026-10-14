import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture,IDs } from './fixture.js';
import { builders } from '../src/commands/registry.js';

test('changelog vereist alleen naam en inhoud; versie optioneel en categorie verwijderd',()=>{
  const command=builders().map(b=>b.toJSON()).find(c=>c.name==='changelog');
  assert.deepEqual(command.options.map(o=>[o.name,o.required]),[['naam',true],['inhoud',true],['versie',false]]);
});
for(const version of [null,'1.4.2']) test(`changelog publiceert echte opgeslagen inhoud ${version ? 'met' : 'zonder'} versie`,async()=>{
  const f=fixture();try {
    await f.ctx.communication.execute(f.interaction('changelog',{naam:'Nieuwe voertuigen',inhoud:'Vijf nieuwe voertuigen toegevoegd.',...(version ? {versie:version} : {})}),f.actor,f.c);
    const row=f.store.get('SELECT * FROM changelogs'),data=JSON.parse(row.pages)[0];
    assert.match(data.embeds[0].description,new RegExp(version ? 'Nieuwe voertuigen 1\\.4\\.2' : '\\*\\*Nieuwe voertuigen\\*\\*'));
    assert.match(data.embeds[0].description,/Vijf nieuwe voertuigen toegevoegd/);
    assert.ok(!data.embeds[0].description.includes('null'));
    assert.equal(f.store.get('SELECT channel_id FROM outbox').channel_id,IDs.channel);
    await f.ctx.outbox.flush();assert.equal(f.records.filter(r=>r.send).length,1);
    assert.equal(f.records.find(r=>r.send).send.files[0].name,'rlrp-banner.png');
  }finally {f.store.close();}
});
test('changelogknoppen halen de juiste onveranderlijke pagina uit SQLite',async()=>{
  const f=fixture();try {
    await f.ctx.communication.execute(f.interaction('changelog',{naam:'Grote update',inhoud:'Nieuwe voertuigen en bugfixes.\n'.repeat(150)}),f.actor,f.c);
    const row=f.store.get('SELECT * FROM changelogs'),list=JSON.parse(row.pages);
    assert.ok(list.length>1);
    await f.ctx.communication.button(f.interaction('changelog',{},null,IDs.target),row.id,'1');
    const result=f.records.filter(r=>r.reply).at(-1).reply;
    assert.deepEqual(result.embeds,list[1].embeds);
    assert.match(result.embeds[0].footer.text,/Pagina 2\//);
    assert.equal(f.store.get('SELECT pages FROM changelogs').pages,row.pages);
    await assert.rejects(f.ctx.communication.button(f.interaction('changelog'),row.id,String(list.length)),/Ongeldige pagina/);
  }finally {f.store.close();}
});
