const document = name => ({ name, description: `Beheer en lees ${name}.`, scope: 'public', subcommands: [
  { name: 'bekijken', description: 'Lees de gepubliceerde actuele versie.', scope: 'public', options: [['int','versie','Specifieke versie',false,1,2147483647]] },
  { name: 'toevoegen', description: 'Sla een nieuwe onveranderlijke versie op.', scope: 'management', permission: 'ManageGuild', options: [['string','titel','Titel',true],['string','inhoud','Volledige tekst',true,null,6000]] },
  { name: 'publiceren', description: 'Publiceer een opgeslagen versie in het regelskanaal.', scope: 'management', permission: 'ManageGuild', options: [['int','versie','Versie',true,1,2147483647]] },
  { name: 'accepteren', description: 'Leg vast dat je deze gepubliceerde versie accepteert.', scope: 'public', options: [['int','versie','Versie',true,1,2147483647]] },
  { name: 'acceptaties', description: 'Bekijk acceptaties voor een versie.', scope: 'management', permission: 'ViewAuditLog', options: [['int','versie','Versie',true,1,2147483647]] }
] });
export const communityCommands = [
  { name: 'giveaway', description: 'Start, reroll of stop een giveaway.', scope: 'public', subcommands: [
    { name: 'start', description: 'Start een nieuwe giveaway.', scope: 'management', permission: 'ManageGuild', options: [['string','prijs','Prijs of beloning',true,null,200],['string','duur','Bijvoorbeeld 30m, 2h of 7d',true],['int','winnaars','Aantal winnaars',true,1,20],['channel','kanaal','Publicatiekanaal',true],['string','voorwaarden','Optionele voorwaarden',false,null,1000]] },
    { name: 'reroll', description: 'Trek een nieuwe winnaar uit dezelfde deelnemers.', scope: 'management', permission: 'ManageGuild', options: [['string','id','Giveaway-ID',true]] },
    { name: 'stop', description: 'Beëindig een actieve giveaway direct.', scope: 'management', permission: 'ManageGuild', options: [['string','id','Giveaway-ID',true]] },
  ] },
  document('apv'), document('regels'),
  { name: 'evenement', description: 'Maak en beheer roleplay-evenementen.', scope: 'public', subcommands: [
    { name: 'maken', description: 'Maak een Discord-evenement en RSVP-bericht.', scope: 'management', permission: 'CreateEvents', options: [['string','naam','Naam',true],['string','beschrijving','Beschrijving',true],['string','start','ISO-8601 met tijdzone',true],['string','duur','Bijvoorbeeld 2h',true],['string','locatie','Ingame locatie of URL',true],['int','capaciteit','Maximale deelnemers',true,1,1000],['channel','kanaal','Publicatiekanaal',true]] },
    { name: 'lijst', description: 'Bekijk geplande evenementen.', scope: 'public', options: [] },
    { name: 'deelnemers', description: 'Bekijk evenementaanmeldingen.', scope: 'management', permission: 'ManageEvents', options: [['string','id','Evenement-ID',true]] },
    { name: 'annuleren', description: 'Annuleer een gepland evenement.', scope: 'management', permission: 'ManageEvents', options: [['string','id','Evenement-ID',true]] }
  ] },
  { name: 'fivem', description: 'Bekijk de FiveM-server.', scope: 'public', subcommands: [
    { name: 'status', description: 'Toon echte serverstatus en spelersaantal.', options: [] },
    { name: 'spelers', description: 'Toon spelersnamen wanneer dit is toegestaan.', options: [] }
  ] }
];
