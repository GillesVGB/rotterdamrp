export const staffCommands = [
  { name: 'aannemen', description: 'Neem een medewerker aan en geef de geselecteerde Discord-rol.', scope: 'management', permission: 'ManageRoles', options: [['user','gebruiker','Nieuwe medewerker',true],['role','functie','Selecteer de echte Discord-rol van de rank',true],['string','reden','Reden',false],['string','opmerking','Interne opmerking',false]] },
  { name: 'ontslag', description: 'Ontsla een medewerker en verwijder de staffrollen.', scope: 'management', permission: 'ManageRoles', options: [['user','gebruiker','Medewerker',true],['string','reden','Reden',true]] },
  { name: 'staffupdate', description: 'Voer een rank-up of rank-down uit.', scope: 'management', permission: 'ManageRoles', options: [['user','gebruiker','Medewerker',true],['string','type','Type wijziging',true,['rank-up','rank-down']],['role','nieuwe_rank','Selecteer de echte Discord-rol van de nieuwe rank',true],['string','reden','Reden',true]] },
  { name: 'staffoverzicht', description: 'Toon alle geregistreerde medewerkers.', scope: 'management', permission: 'ViewAuditLog', options: [] },
  { name: 'staffgeschiedenis', description: 'Bekijk de staffhistorie van een medewerker.', scope: 'management', permission: 'ViewAuditLog', options: [['user','gebruiker','Medewerker',true]] },
  { name: 'staffopmerking', description: 'Sla een interne staffopmerking op.', scope: 'management', permission: 'ManageRoles', options: [['user','gebruiker','Medewerker',true],['string','opmerking','Interne opmerking',true]] },
  { name: 'staffwaarschuwing', description: 'Beheer interne staffwaarschuwingen.', scope: 'management', permission: 'ManageRoles', subcommands: [
    { name: 'geven', description: 'Registreer een interne waarschuwing.', options: [['user','gebruiker','Medewerker',true],['string','reden','Interne reden',true]] },
    { name: 'bekijken', description: 'Bekijk interne waarschuwingen.', options: [['user','gebruiker','Medewerker',true]] },
    { name: 'intrekken', description: 'Trek een waarschuwing in; de historie blijft bewaard.', options: [['int','id','Waarschuwing-ID',true,1,2147483647],['string','reden','Reden',true]] }
  ] }
];
