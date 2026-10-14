import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/database/store.js';
import { backup,DatabaseSync } from 'node:sqlite';
import { defaults,IDs } from './fixture.js';
test('migraties zijn herhaalbaar en data overleeft een gesloten verbinding',()=>{
  const folder=mkdtempSync(join(tmpdir(),'rlrp-test-')),path=join(folder,'db.sqlite');
  try {
    let s=new Store(path);s.init(IDs.guild,defaults());const action=s.begin(IDs.guild,IDs.actor,IDs.target,'ban');s.close();
    s=new Store(path);assert.equal(s.recover(),1);assert.equal(s.get('SELECT state FROM actions WHERE id=?',action).state,'uncertain');assert.equal(s.recover(),0);assert.equal(s.all('SELECT * FROM migrations').length,5);s.close();
  } finally {rmSync(folder,{recursive:true,force:true});}
});
test('transacties draaien terug bij fouten',()=>{const s=new Store();assert.throws(()=>s.transaction(()=>{s.run('INSERT INTO audit_seen VALUES (?,?)','a',1);throw new Error('stop');}));assert.equal(s.all('SELECT * FROM audit_seen').length,0);s.close();});
test('SQL-parameters behandelen injectietekst als data',()=>{const s=new Store();const v="'; DROP TABLE hits; --";s.hit(IDs.guild,v,'spam',5000);assert.equal(s.get('SELECT actor FROM hits').actor,v);assert.equal(s.all('SELECT * FROM hits').length,1);s.close();});
test('configuratie-updates hebben compare-and-swap versiecontrole',()=>{const s=new Store();s.init(IDs.guild,defaults());s.saveConfig(IDs.guild,defaults(),1);assert.throws(()=>s.saveConfig(IDs.guild,defaults(),1),/intussen/);assert.equal(s.config(IDs.guild).revision,2);s.close();});
test('command-rate-limit telt uitsluitend interacties binnen het tijdvenster',()=>{const s=new Store();assert.equal(s.hit(IDs.guild,IDs.actor,'command:ban',1000,1000),1);assert.equal(s.hit(IDs.guild,IDs.actor,'command:ban',1000,1500),2);assert.equal(s.hit(IDs.guild,IDs.actor,'command:ban',1000,2600),1);s.close();});
test('audit-entry deduplicatie',()=>{const s=new Store();assert.equal(s.onceAudit('entry'),true);assert.equal(s.onceAudit('entry'),false);s.close();});
test('outbox referenties zijn idempotent',()=>{const s=new Store();s.queue(IDs.guild,IDs.channel,{},'same');s.queue(IDs.guild,IDs.channel,{},'same');assert.equal(s.all('SELECT * FROM outbox').length,1);s.close();});
test('SQLite online backup herstelt configuratie, data en migraties',async()=>{const folder=mkdtempSync(join(tmpdir(),'rlrp-backup-'));const s=new Store();try{s.init(IDs.guild,defaults());s.hit(IDs.guild,IDs.actor,'command:ban',1000);const path=join(folder,'snapshot.sqlite');await backup(s.db,path);const recovered=new Store(path);try{assert.equal(recovered.config(IDs.guild).revision,1);assert.equal(recovered.all('SELECT * FROM hits').length,1);assert.equal(recovered.all('SELECT * FROM migrations').length,5);}finally{recovered.close();}}finally{s.close();rmSync(folder,{recursive:true,force:true});}});

test('migratie 005 behoudt oude staffdata en taken, herstelt rol-IDs en verwijdert setupconfiguratie',()=>{
  const folder=mkdtempSync(join(tmpdir(),'rlrp-legacy-')),path=join(folder,'db.sqlite');
  let legacy,migrated;
  try {
    legacy=new DatabaseSync(path);
    legacy.exec('PRAGMA foreign_keys=ON; CREATE TABLE migrations(version TEXT PRIMARY KEY);');
    for(const version of ['001.sql','002.sql','003.sql','004.sql']) {
      legacy.exec(readFileSync(new URL(`../src/database/migrations/${version}`,import.meta.url),'utf8'));
      legacy.prepare('INSERT INTO migrations VALUES (?)').run(version);
    }
    const c=defaults();
    c.roles.ranks=[{name:'Support',roleId:IDs.support,level:1},{name:'Moderator',roleId:IDs.mod,level:2}];
    c.security={allowUsers:[IDs.owner],rules:{channelDelete:{limit:3,windowSeconds:15}}};
    c.permissions={setup:['owner']};c.channels.security=IDs.channel;c.staff.removeRolesOnDismissal=false;
    legacy.prepare('INSERT INTO config(guild_id,body) VALUES (?,?)').run(IDs.guild,JSON.stringify(c));
    legacy.prepare('INSERT INTO staff VALUES (?,?,?,?,?)').run(IDs.guild,IDs.target,'Moderator','actief',100);
    legacy.prepare('INSERT INTO staff VALUES (?,?,?,?,?)').run(IDs.guild,IDs.protect,'Oude onbekende rank','afwezig',100);
    legacy.prepare('INSERT INTO staff_history(guild_id,user_id,actor,kind,old_rank,new_rank,reason,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(IDs.guild,IDs.target,IDs.actor,'rank-up','Support','Moderator','Goed werk','Intern',100);
    legacy.prepare('INSERT INTO actions VALUES (?,?,?,?,?,?,?,?,?)').run('unfinished',IDs.guild,IDs.actor,IDs.target,'staffupdate','executing','{}',100,null);
    legacy.prepare('INSERT INTO outbox(id,guild_id,channel_id,payload,next_at,created_at) VALUES (?,?,?,?,?,?)').run('pending-publication',IDs.guild,IDs.channel,JSON.stringify({content:'Bestaande publicatie'}),100,100);
    legacy.prepare('INSERT INTO sessions VALUES (?,?,?,?,?,?)').run('old-setup-session',IDs.guild,IDs.owner,1,'{}',Date.now()+60000);
    legacy.close();legacy=null;

    migrated=new Store(path);
    assert.equal(migrated.all('SELECT * FROM migrations').length,5);
    const active=migrated.get('SELECT * FROM staff WHERE user_id=?',IDs.target);
    assert.equal(active.role_id,IDs.mod);assert.equal(active.rank,'Moderator');assert.equal(active.status,'actief');
    const unknown=migrated.get('SELECT * FROM staff WHERE user_id=?',IDs.protect);
    assert.equal(unknown.role_id,null);assert.equal(unknown.rank,'Oude onbekende rank');assert.equal(unknown.status,'afwezig');
    const history=migrated.get('SELECT * FROM staff_history');
    assert.equal(history.old_role_id,IDs.support);assert.equal(history.new_role_id,IDs.mod);
    assert.equal(history.reason,'Goed werk');assert.equal(history.note,'Intern');
    const saved=migrated.get('SELECT * FROM config'),body=JSON.parse(saved.body);
    assert.equal(saved.revision,2);assert.deepEqual(body.roles.ranks,c.roles.ranks);
    assert.ok(!Object.hasOwn(body,'security'));assert.ok(!Object.hasOwn(body,'permissions'));
    assert.ok(!Object.hasOwn(body.channels,'security'));assert.ok(!Object.hasOwn(body.staff,'removeRolesOnDismissal'));
    assert.equal(migrated.config(IDs.guild).staff.dm,c.staff.dm);
    assert.equal(migrated.get("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'"),undefined);
    assert.equal(migrated.get('SELECT state FROM outbox WHERE id=?','pending-publication').state,'pending');
    assert.equal(migrated.recover(),1);assert.equal(migrated.get('SELECT state FROM actions WHERE id=?','unfinished').state,'uncertain');
    migrated.close();migrated=new Store(path);
    assert.equal(migrated.config(IDs.guild).revision,2);assert.equal(migrated.recover(),0);
    assert.equal(migrated.all('SELECT * FROM staff_history').length,1);
  } finally {legacy?.close();migrated?.close();rmSync(folder,{recursive:true,force:true});}
});
