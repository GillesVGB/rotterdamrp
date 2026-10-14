import { prepareHosting } from './src/utils/hosting-runtime.js';
prepareHosting(import.meta.url);
await import('./scripts/register.js');
