# Live acceptatie vóór productie

De offline tests controleren echte SQLite-opslag en gesimuleerde Discord-grenzen. Onderstaande controles vereisen een afgeschermde testguild of een gecontroleerd testkanaal met de werkelijke bot. Gebruik een nieuwe token. Destructieve tests horen niet op de RLRP-productieserver.

| Controle | Verwachte uitkomst |
| --- | --- |
| `npm run doctor` | Kernbotrechten en vaste publicatiekanalen gecontroleerd; hoogste botrol getoond |
| Bot starten met alleen Env-tabje | Geen verplichte `.env`; console meldt succesvolle registratie voor de juiste app/server |
| `npm run register` | 32 guildcommands geregistreerd voor de juiste app/server, ook zonder `.env` |
| `/help` | Alle commands/subcommands, vereiste en optionele parameters, rechten en werkende categorie-/paginaknoppen |
| Beheerrol / Administrator / servereigenaar | Alle commands toegankelijk; echte botrechten en hiërarchie blijven gecontroleerd |
| Gewone moderator zonder ingestelde staffgroep | Moderatie toegankelijk met de vereiste Discord-permissie; zonder die permissie en Beheerrol server-side afgewezen |
| Gewoon lid bij staff-/communicatiebeheer | Server-side afgewezen, ook als het slash command zichtbaar is |
| Beheerrol weghalen bij lid zonder Administrator | Volgende beheeractie weigert toegang |
| `:rlogo:` | Echte bereikbare serveremoji in embed en reactie op aanneming |
| `/aannemen` met lager testlid | Native Discord-rolkiezer, echte rol toegewezen zonder vooraf ingestelde ranks, rol-ID en historie opgeslagen; DM-fout apart gelogd |
| `/staffupdate` | Native rolkiezer, nieuwe rankrol echt toegevoegd, oude staffrankrol echt verwijderd, andere communityrollen behouden |
| Promotie/demotie met omgekeerde geconfigureerde levels | Richting volgt altijd de echte Discord-rolhiërarchie |
| `/ontslag` | Opgeslagen/herkende staffrollen altijd verwijderd, andere communityrollen behouden, historie correct |
| Staffpublicatiekanalen | Aannemen/staffupdate/ontslag altijd naar `1560050091245699245`, ook na herstart met bestaande database |
| Vaste kanalen aanpassen via config-import | Vaste RLRP-bestemmingen blijven gelden |
| Beschermd account/Beheer/hogere rank modereren | Afwijzing vóór mutatie |
| Warn en clearwarnings | Actieve status gewijzigd, oorspronkelijke historie behouden |
| Korte timeout en untimeout | Discord-timeout wijzigt daadwerkelijk |
| Tijdelijke ban van testaccount | Echte ban en automatisch verloop na herstart; bot moet online zijn |
| Permanente ban | Geen automatische unban; sluit de test handmatig af |
| Ban vervangen door andere actor | Oud banjob heft de nieuwe ban niet op |
| `/lock` en `/unlock` | Eerdere allow/deny/null terug; rol-overwrites gedocumenteerd |
| `/purge` | Alleen jongere berichten verwijderd, aantallen kloppen |
| `/say` en `/embed` | Doelkanaal gebruikt, onveilige massamentions geweigerd |
| `/changelog` met alleen naam + inhoud | Altijd in `1226509287459655704`, banner, juiste paginanummers, knoppen en onveranderlijke inhoud |
| `/changelog` met versie | Optionele versie getoond zonder extra verplichte parameters |
| Giveaway deelnemen | Unieke entry, dubbelklik levert geen dubbele deelname |
| Giveaway onvoldoende deelnemers | Nul winnaars, geen verzonnen winnaar |
| Giveaway herstart/reroll | Nieuwe commitment, historie blijft, vorige winnaars uitgesloten bij reroll |
| Giveawaybewijs | Verifier klopt tegen oorspronkelijke commitment en snapshot |
| APV/regels publiceren/accepteren | Versienummer en juiste document-ID; nieuwe versie wist oude acceptatie niet |
| Evenement | Discord Scheduled Event, capaciteit, afmelden, reminder, start en sluiten |
| FiveM beschikbaar/onbereikbaar | Juiste echte aantallen of onbekend; geen IP/license-informatie |
| Interne staffwaarschuwing | Publiek kanaal geweigerd; reden alleen privé/intern |
| Gewone berichten, joins en nieuwe botuitnodiging | Alleen beschikbare wijzigings-/ledenlogs; geen automatische sanctie door deze bot |
| Auditlogevent in testguild | Beschikbare uitvoerder, doelwit en actie gelogd zonder automatische sanctie |
| Outbox met ontbrekend Send Messages | Blijft pending; bezorgt na rechtenherstel zonder stilzwijgend verlies |
| Proces abrupt stoppen | Open actie uncertain; bans/draws/events/outbox herstellen zonder blind mutatieretry |
| Back-up en restore in testkopie | `quick_check=ok`, records behouden en geplande taken hervat |

Noteer afwijkingen met de echte Discord-foutcodes en deel geen token of webhook-URL's. Controleer de botrol en de vaste publicatiekanalen voordat je de beheercommands op productie gebruikt.
