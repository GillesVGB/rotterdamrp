export const moderationCommands = [
  { name: 'ban', description: 'Ban een gebruiker permanent of tijdelijk.', scope: 'moderator', permission: 'BanMembers', options: [['user','gebruiker','Gebruiker',true],['string','reden','Reden',true],['string','duur','Bijvoorbeeld 7d; leeg is permanent',false]] },
  { name: 'unban', description: 'Hef een ban op.', scope: 'moderator', permission: 'BanMembers', options: [['string','gebruiker_id','Discord-ID',true],['string','reden','Reden',true]] },
  { name: 'kick', description: 'Verwijder een gebruiker uit de server.', scope: 'moderator', permission: 'KickMembers', options: [['user','gebruiker','Gebruiker',true],['string','reden','Reden',true]] },
  { name: 'warn', description: 'Registreer een moderatiewaarschuwing.', scope: 'support', permission: 'ModerateMembers', options: [['user','gebruiker','Gebruiker',true],['string','reden','Reden',true]] },
  { name: 'timeout', description: 'Geef een gebruiker een timeout.', scope: 'moderator', permission: 'ModerateMembers', options: [['user','gebruiker','Gebruiker',true],['string','duur','Bijvoorbeeld 30m; maximaal 28d',true],['string','reden','Reden',true]] },
  { name: 'untimeout', description: 'Hef een timeout op.', scope: 'moderator', permission: 'ModerateMembers', options: [['user','gebruiker','Gebruiker',true],['string','reden','Reden',true]] },
  { name: 'warnings', description: 'Bekijk waarschuwingen.', scope: 'support', permission: 'ModerateMembers', options: [['user','gebruiker','Gebruiker',true]] },
  { name: 'clearwarnings', description: 'Trek actieve waarschuwingen in met behoud van historie.', scope: 'moderator', permission: 'ModerateMembers', options: [['user','gebruiker','Gebruiker',true]] },
  { name: 'purge', description: 'Verwijder maximaal 100 berichten jonger dan 14 dagen.', scope: 'moderator', permission: 'ManageMessages', options: [['int','aantal','Aantal berichten',true,1,100]] },
  { name: 'lock', description: 'Sluit dit kanaal voor @everyone.', scope: 'moderator', permission: 'ManageChannels', options: [] },
  { name: 'unlock', description: 'Herstel de oorspronkelijke kanaalrechten.', scope: 'moderator', permission: 'ManageChannels', options: [] },
  { name: 'modlogs', description: 'Bekijk de moderatiehistorie.', scope: 'moderator', permission: 'ViewAuditLog', options: [['user','gebruiker','Gebruiker',true]] }
];
