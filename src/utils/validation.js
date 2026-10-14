export class UserError extends Error {}
export const id = value => {
  if (!/^\d{17,20}$/.test(String(value))) throw new UserError('Ongeldig Discord-ID.');
  return String(value);
};
export function text(value, max = 1000, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw new UserError(`Gebruik ${min}–${max} tekens.`);
  return value.trim();
}
export function integer(value, min, max) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new UserError(`Gebruik een geheel getal van ${min} tot ${max}.`);
  return n;
}
export function duration(value, max = 365 * 86400000) {
  const match = /^(\d+)(s|m|h|d|w)$/.exec(String(value).trim());
  if (!match) throw new UserError('Gebruik een duur zoals 30m, 2h, 7d of 1w.');
  return integer(Number(match[1]) * ({ s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 }[match[2]]), 1000, max);
}
export function future(value) {
  const parts=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d)(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.exec(value);
  if (!parts) throw new UserError('Gebruik ISO-8601 met tijdzone, bijvoorbeeld 2026-12-01T20:00:00+01:00.');
  const [,year,month,day,hour,minute,second='0']=parts.map((v,index)=>index===0?v:Number(v));
  if(month<1 || month>12 || day<1 || day>new Date(Date.UTC(year,month,0)).getUTCDate() || hour>23 || minute>59 || Number(second)>59) throw new UserError('Ongeldige kalenderdatum of tijd.');
  const n = Date.parse(value);
  if (!Number.isFinite(n) || n <= Date.now() + 60000) throw new UserError('De start moet minstens één minuut in de toekomst liggen.');
  return n;
}
export function url(value) {
  let u;
  try { u = new URL(value); } catch { throw new UserError('Ongeldige URL.'); }
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) throw new UserError('Gebruik een HTTP(S)-URL zonder wachtwoord.');
  return u.href;
}
export function noMassMentions(value) {
  if (/@(?:everyone|here)|<@&\d+>/.test(value)) throw new UserError('Massamentions en rolmentions zijn hier niet toegestaan.');
  return value;
}
export const safe = value => String(value ?? '').replace(/@(everyone|here)/g, '@\u200b$1');
export const truncate = (value, max = 1000) => String(value ?? '').slice(0, max);
export function pages(value, size = 3500) {
  const result = [];
  let remaining = String(value);
  while (remaining.length) {
    let end = Math.min(size, remaining.length);
    if (end < remaining.length) { const line = remaining.lastIndexOf('\n', end); if (line > size / 2) end = line; }
    result.push(remaining.slice(0, end)); remaining = remaining.slice(end).replace(/^\n/, '');
  }
  return result.length ? result : ['Geen gegevens.'];
}
