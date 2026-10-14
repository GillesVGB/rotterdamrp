export const utilityCommands = [
  { name: 'say', description: 'Verstuur een bericht zonder massamentions.', scope: 'management', permission: 'ManageMessages', options: [['string','bericht','Bericht',true,null,1900],['channel','kanaal','Doelkanaal',false]] },
  { name: 'embed', description: 'Publiceer een huisstijlembed.', scope: 'management', permission: 'ManageMessages', options: [['string','titel','Titel',true,null,256],['string','beschrijving','Beschrijving',true,null,3500],['string','kleur','Kleur #RRGGBB',true],['channel','kanaal','Kanaal',true],['string','footer','Footer',false,null,1000],['string','thumbnail','HTTP(S)-afbeeldings-URL',false]] },
  { name: 'changelog', description: 'Publiceer een changelog met paginaknoppen.', scope: 'management', permission: 'ManageMessages', options: [['string','naam','Naam van de update',true],['string','versie','Versienummer',true],['string','categorie','Categorie',true],['string','inhoud','Changelogtekst',true,null,6000]] },
  { name: 'setup', description: 'Open het interactieve configuratiepaneel.', scope: 'management', owner: true, options: [] },
  { name: 'systeem', description: 'Bekijk systeemgezondheid en onderbroken acties.', scope: 'management', owner: true, subcommands: [
    { name: 'status', description: 'Bekijk database en wachtrij.', options: [] },
    { name: 'acties', description: 'Bekijk acties die controle vereisen.', options: [] },
    { name: 'afhandelen', description: 'Markeer een handmatig gecontroleerde actie.', options: [['string','id','Actiereferentie',true],['string','reden','Wat heb je gecontroleerd of hersteld?',true]] }
  ] }
];
