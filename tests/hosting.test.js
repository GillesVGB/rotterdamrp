import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertRuntime,loadOptionalEnv } from '../src/utils/hosting-runtime.js';

test('hosting accepteert de geteste Node 24 runtime',()=>{assert.doesNotThrow(()=>assertRuntime('24.14.0'));assert.doesNotThrow(()=>assertRuntime('24.12.0'));});
for(const version of ['22.19.0','24.0.0','25.0.0']) test(`hosting weigert ongeschikte runtime ${version}`,()=>assert.throws(()=>assertRuntime(version),/Node.js 24/));
test('ontbrekende .env is toegestaan voor hostingvariabelen',()=>{assert.equal(loadOptionalEnv('missing',()=>{throw Object.assign(new Error('missing'),{code:'ENOENT'});}),false);});
test('toegangs- of leesfout van .env wordt niet verborgen',()=>{assert.throws(()=>loadOptionalEnv('blocked',()=>{throw Object.assign(new Error('denied'),{code:'EACCES'});}),/denied/);});
test('Node laadt .env en behoudt de voorrang van bestaande hostingvariabelen',()=>{
  const folder=mkdtempSync(join(tmpdir(),'rlrp-hosting-'));
  try {
    const path=join(folder,'.env');writeFileSync(path,'RLRP_HOSTING_TEST_SOURCE=file\nRLRP_HOSTING_TEST_EXTRA=loaded\n');
    const helper=new URL('../src/utils/hosting-runtime.js',import.meta.url).href;
    const code=`import {loadOptionalEnv} from ${JSON.stringify(helper)};loadOptionalEnv(${JSON.stringify(path)});console.log(JSON.stringify({source:process.env.RLRP_HOSTING_TEST_SOURCE,extra:process.env.RLRP_HOSTING_TEST_EXTRA}));`;
    const result=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',env:{...process.env,RLRP_HOSTING_TEST_SOURCE:'panel'}});
    assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{source:'panel',extra:'loaded'});
  } finally {rmSync(folder,{recursive:true,force:true});}
});
