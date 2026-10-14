export const helpCategories = [
  {value:'alle',label:'Alle commands'}, {value:'staff',label:'Staffmanagement'},
  {value:'moderatie',label:'Moderatie'},
  {value:'communicatie',label:'Communicatie'}, {value:'community',label:'Giveaways & evenementen'},
  {value:'documenten',label:'APV & regels'}, {value:'fivem',label:'FiveM'}, {value:'beheer',label:'Systeem & hulp'}
];
export const utilityCommands = [
  { name: 'help', description: 'Bekijk alle commands, parameters en benodigde rechten.', scope: 'public', options: [['string','categorie','Kies een categorie of bekijk alles',false,helpCategories.map(c=>c.value)]] },
  { name: 'say', description: 'Verstuur een bericht zonder massamentions.', scope: 'management', permission: 'ManageMessages', options: [['string','bericht','Bericht',true,null,1900],['channel','kanaal','Doelkanaal',false]] },
  { name: 'embed', description: 'Publiceer een huisstijlembed.', scope: 'management', permission: 'ManageMessages', options: [['string','titel','Titel',true,null,256],['string','beschrijving','Beschrijving',true,null,3500],['string','kleur','Kleur #RRGGBB',true],['channel','kanaal','Kanaal',true],['string','footer','Footer',false,null,1000],['string','thumbnail','HTTP(S)-afbeeldings-URL',false]] },
  { name: 'changelog', description: 'Publiceer een changelog met paginaknoppen.', scope: 'management', permission: 'ManageMessages', options: [['string','naam','Naam van de update',true],['string','inhoud','Changelogtekst',true,null,6000],['string','versie','Versienummer (optioneel)',false,null,50]] },
  { name: 'systeem', description: 'Bekijk systeemgezondheid en onderbroken acties.', scope: 'management', owner: true, subcommands: [
    { name: 'status', description: 'Bekijk database en wachtrij.', options: [] },
    { name: 'acties', description: 'Bekijk acties die controle vereisen.', options: [] },
    { name: 'afhandelen', description: 'Markeer een handmatig gecontroleerde actie.', options: [['string','id','Actiereferentie',true],['string','reden','Wat heb je gecontroleerd of hersteld?',true]] }
  ] }
];
