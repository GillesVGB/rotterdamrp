import process from 'node:process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function assertRuntime(version=process.versions.node) {
  const [major,minor]=version.split('.').map(Number);
  if(major!==24 || minor<12) throw new Error('RLRP vereist Node.js 24.12 of hoger binnen 24.x. Kies Node 24 bij Startup en controleer node --version.');
}
export function loadOptionalEnv(path='.env',loader=process.loadEnvFile) {
  try {loader(path);return true;}
  catch(error) {if(error.code==='ENOENT') return false;throw error;}
}
export function prepareHosting(entryUrl) {
  assertRuntime();
  process.chdir(dirname(fileURLToPath(entryUrl)));
  return loadOptionalEnv();
}
