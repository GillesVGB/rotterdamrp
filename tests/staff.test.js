import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture,IDs } from './fixture.js';
import { Collection } from 'discord.js';

const hire = f => f.ctx.staff.execute(f.interaction('aannemen',{gebruiker:f.target,functie:f.roles.get(IDs.support)}),f.actor,f.c);

test('aannemen kent de geselecteerde Discord-rol toe, slaat historie op en publiceert',async()=>{
  const f=fixture();
  try {
    await f.ctx.staff.execute(f.interaction('aannemen',{gebruiker:f.target,functie:f.roles.get(IDs.support),opmerking:'Intern'}),f.actor,f.c);
    const staff=f.store.get('SELECT rank,role_id FROM staff'),history=f.store.get('SELECT note,new_role_id FROM staff_history');
    assert.equal(staff.rank,'Support');assert.equal(staff.role_id,IDs.support);
    assert.equal(history.note,'Intern');assert.equal(history.new_role_id,IDs.support);
    assert.equal(f.target.roles.cache.has(IDs.support),true);
    const data=JSON.parse(f.store.get('SELECT payload FROM outbox').payload);
    assert.match(data.embeds[0].description,new RegExp(`<@&${IDs.support}>`));
    assert.ok(!data.embeds[0].description.includes('Intern'));
  } finally {f.store.close();}
});

test('bestaande toewijsbare rol hoeft niet vooraf als rank geconfigureerd te zijn',async()=>{
  const f=fixture();
  try {
    const selected=f.role('123456789012345710',30);selected.name='Developer';f.roles.set(selected.id,selected);
    await f.ctx.staff.execute(f.interaction('aannemen',{gebruiker:f.target,functie:selected}),f.actor,f.c);
    assert.equal(f.target.roles.cache.has(selected.id),true);
    assert.equal(f.store.get('SELECT rank,role_id FROM staff').rank,'Developer');
    assert.equal(f.store.get('SELECT role_id FROM staff').role_id,selected.id);
  } finally {f.store.close();}
});

test('door Discord beheerde rol verandert geen rollen of staffregistratie',async()=>{
  const f=fixture();
  try {
    const selected=f.role('123456789012345710',30);selected.managed=true;f.roles.set(selected.id,selected);
    await assert.rejects(f.ctx.staff.execute(f.interaction('aannemen',{gebruiker:f.target,functie:selected}),f.actor,f.c),/niet toewijsbaar/);
    assert.equal(f.records.filter(r=>r.add || r.remove).length,0);
    assert.equal(f.store.all('SELECT * FROM staff').length,0);
  } finally {f.store.close();}
});

test('rank-up verandert rollen en legt oude en nieuwe rank met Discord-IDs vast',async()=>{
  const f=fixture();
  try {
    await hire(f);
    await f.ctx.staff.execute(f.interaction('staffupdate',{gebruiker:f.target,type:'rank-up',nieuwe_rank:f.roles.get(IDs.mod),reden:'Goed werk'}),f.actor,f.c);
    assert.equal(f.target.roles.cache.has(IDs.mod),true);assert.equal(f.target.roles.cache.has(IDs.support),false);
    const row=f.store.get("SELECT * FROM staff_history WHERE kind='rank-up'");
    assert.equal(row.old_rank,'Support');assert.equal(row.new_rank,'Moderator');
    assert.equal(row.old_role_id,IDs.support);assert.equal(row.new_role_id,IDs.mod);
  } finally {f.store.close();}
});

test('rank-down naar hogere Discord-rol is verboden',async()=>{
  const f=fixture();
  try {
    await hire(f);
    await assert.rejects(f.ctx.staff.execute(f.interaction('staffupdate',{gebruiker:f.target,type:'rank-down',nieuwe_rank:f.roles.get(IDs.mod),reden:'Test'}),f.actor,f.c),/richting/);
    assert.equal(f.store.get('SELECT role_id FROM staff').role_id,IDs.support);
  } finally {f.store.close();}
});

test('ontslag verwijdert staffrollen en bewaart een onafhankelijke communityrol',async()=>{
  const f=fixture();
  try {
    await hire(f);
    const community=f.role('123456789012345711',4);f.roles.set(community.id,community);f.target.roles.cache.set(community.id,community);
    await f.ctx.staff.execute(f.interaction('ontslag',{gebruiker:f.target,reden:'Test'}),f.actor,f.c);
    assert.equal(f.target.roles.cache.has(IDs.support),false);
    assert.equal(f.target.roles.cache.has(community.id),true);
    const staff=f.store.get('SELECT status,role_id FROM staff');
    assert.equal(staff.status,'ontslagen');assert.equal(staff.role_id,null);
    assert.equal(f.store.get("SELECT old_role_id FROM staff_history WHERE kind='ontslag'").old_role_id,IDs.support);
  } finally {f.store.close();}
});

test('mislukte rolverwijdering registreert geen voltooid ontslag of ontslagpublicatie',async()=>{
  const f=fixture();
  try {
    await hire(f);
    const queued=f.store.all('SELECT * FROM outbox').length,replies=f.records.filter(r=>r.reply).length;
    f.target.roles.remove=async()=>{throw new Error('Missing Permissions');};
    await assert.rejects(f.ctx.staff.execute(f.interaction('ontslag',{gebruiker:f.target,reden:'Test'}),f.actor,f.c),/Missing Permissions/);
    assert.equal(f.store.get('SELECT status,role_id FROM staff').status,'actief');
    assert.equal(f.store.get('SELECT role_id FROM staff').role_id,IDs.support);
    assert.equal(f.store.all("SELECT * FROM staff_history WHERE kind='ontslag'").length,0);
    assert.equal(f.store.all('SELECT * FROM outbox').length,queued);
    assert.equal(f.records.filter(r=>r.reply).length,replies);
    assert.equal(f.store.get("SELECT state FROM actions WHERE kind='ontslag'").state,'uncertain');
  } finally {f.store.close();}
});

test('applicatie-upvote bij aannemen/promotie en downvote bij demotie/ontslag',async()=>{
  const f=fixture();
  try {
    const make=(name,id)=>({name,id,available:true,toString:()=>`<:${name}:${id}>`,imageURL:()=>`https://cdn.discordapp.com/emojis/${id}.webp`});
    f.ctx.client.application={emojis:{cache:new Collection([['up',make('upvote','123456789012345704')],['down',make('downvote','123456789012345705')]])}};
    await hire(f);
    await f.ctx.staff.execute(f.interaction('staffupdate',{gebruiker:f.target,type:'rank-up',nieuwe_rank:f.roles.get(IDs.mod),reden:'Test'}),f.actor,f.c);
    await f.ctx.staff.execute(f.interaction('staffupdate',{gebruiker:f.target,type:'rank-down',nieuwe_rank:f.roles.get(IDs.support),reden:'Test'}),f.actor,f.c);
    await f.ctx.staff.execute(f.interaction('ontslag',{gebruiker:f.target,reden:'Test'}),f.actor,f.c);
    const titles=f.store.all('SELECT payload FROM outbox ORDER BY created_at,rowid').map(r=>JSON.parse(r.payload).embeds[0].title);
    assert.match(titles[0],/:upvote:/);assert.match(titles[1],/:upvote:/);assert.match(titles[2],/:downvote:/);assert.match(titles[3],/:downvote:/);
  } finally {f.store.close();}
});
