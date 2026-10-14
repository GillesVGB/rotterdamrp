import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/database/store.js';
import { backup } from 'node:sqlite';
import { defaults,IDs } from './fixture.js';
test('migraties zijn herhaalbaar en data overleeft een gesloten verbinding',()=>{
  const folder=mkdtempSync(join(tmpdir(),'rlrp-test-')),path=join(folder,'db.sqlite');
  try {
    let s=new Store(path);s.init(IDs.guild,defaults());const action=s.begin(IDs.guild,IDs.actor,IDs.target,'ban');s.close();
    s=new Store(path);assert.equal(s.recover(),1);assert.equal(s.get('SELECT state FROM actions WHERE id=?',action).state,'uncertain');assert.equal(s.recover(),0);assert.equal(s.all('SELECT * FROM migrations').length,4);s.close();
  } finally {rmSync(folder,{recursive:true,force:true});}
});
test('transacties draaien terug bij fouten',()=>{const s=new Store();assert.throws(()=>s.transaction(()=>{s.run('INSERT INTO audit_seen VALUES (?,?)','a',1);throw new Error('stop');}));assert.equal(s.all('SELECT * FROM audit_seen').length,0);s.close();});
test('SQL-parameters behandelen injectietekst als data',()=>{const s=new Store();const v="'; DROP TABLE hits; --";s.hit(IDs.guild,v,'spam',5000);assert.equal(s.get('SELECT actor FROM hits').actor,v);assert.equal(s.all('SELECT * FROM hits').length,1);s.close();});
test('configuratie-updates hebben compare-and-swap versiecontrole',()=>{const s=new Store();s.init(IDs.guild,defaults());s.saveConfig(IDs.guild,defaults(),1);assert.throws(()=>s.saveConfig(IDs.guild,defaults(),1),/intussen/);assert.equal(s.config(IDs.guild).revision,2);s.close();});
test('security sliding window is persistent en telt uitsluitend het venster',()=>{const s=new Store();assert.equal(s.hit(IDs.guild,IDs.actor,'delete',1000,1000),1);assert.equal(s.hit(IDs.guild,IDs.actor,'delete',1000,1500),2);assert.equal(s.hit(IDs.guild,IDs.actor,'delete',1000,2600),1);s.close();});
test('audit-entry deduplicatie',()=>{const s=new Store();assert.equal(s.onceAudit('entry'),true);assert.equal(s.onceAudit('entry'),false);s.close();});
test('outbox referenties zijn idempotent',()=>{const s=new Store();s.queue(IDs.guild,IDs.channel,{},'same');s.queue(IDs.guild,IDs.channel,{},'same');assert.equal(s.all('SELECT * FROM outbox').length,1);s.close();});
test('SQLite online backup herstelt configuratie, data en migraties',async()=>{const folder=mkdtempSync(join(tmpdir(),'rlrp-backup-'));const s=new Store();try{s.init(IDs.guild,defaults());s.hit(IDs.guild,IDs.actor,'spam',1000);const path=join(folder,'snapshot.sqlite');await backup(s.db,path);const recovered=new Store(path);try{assert.equal(recovered.config(IDs.guild).revision,1);assert.equal(recovered.all('SELECT * FROM hits').length,1);assert.equal(recovered.all('SELECT * FROM migrations').length,4);}finally{recovered.close();}}finally{s.close();rmSync(folder,{recursive:true,force:true});}});
