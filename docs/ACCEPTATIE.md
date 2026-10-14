# Live acceptatie vóór productie

De offline tests controleren echte SQLite-opslag en gesimuleerde Discord-grenzen. Onderstaande controles vereisen een afgeschermde testguild of een gecontroleerd testkanaal met de werkelijke bot. Gebruik een nieuwe token. Destructieve tests horen niet op de RLRP-productieserver.

| Controle | Verwachte uitkomst |
| --- | --- |
| `npm run doctor` | Botrechten aanwezig; alle gebruikte kanalen bereikbaar; ranks onder botrol |
| `npm run register` | 33 guildcommands geregistreerd voor de juiste app/server |
| `/setup` met ownerrol | Privépaneel, echte kanaal-/rolselecties, bewaarde wijziging na herstart |
| `/setup` zonder ownerrol | Server-side afwijzing, ook bij zichtbare slash command |
| Ownerrol weghalen tijdens setupsessie | Volgende knop/modal weigert toegang |
| Twee setupsessies | Oude revisie mag nieuwe configuratie niet overschrijven |
| `:rlogo:` | Echte bereikbare serveremoji in embed en reactie op aanneming |
| `/aannemen` met lager testlid | Echte rankrol, historie, publicatie, stafflog; eventuele DM-fout apart gelogd |
| `/staffupdate` | Richting en hierarchy gecontroleerd, oude rank vervangen, historie correct |
| `/ontslag` | Alleen ingestelde staffrollen verwijderd; keuze om te behouden werkt |
| Protected/owner/hogere rank modereren | Afwijzing vóór mutatie |
| Warn en clearwarnings | Actieve status gewijzigd, oorspronkelijke historie behouden |
| Korte timeout en untimeout | Discord-timeout wijzigt daadwerkelijk |
| Tijdelijke ban van testaccount | Echte ban en automatisch verloop na herstart; bot moet online zijn |
| Permanente ban | Geen automatische unban; sluit de test handmatig af |
| Ban vervangen door andere actor | Oud banjob heft de nieuwe ban niet op |
| `/lock` en `/unlock` | Eerdere allow/deny/null terug; rol-overwrites gedocumenteerd |
| `/purge` | Alleen jongere berichten verwijderd, aantallen kloppen |
| `/say` en `/embed` | Doelkanaal gebruikt, onveilige massamentions geweigerd |
| `/changelog` | Banner, juiste paginanummers, knoppen en onveranderlijke inhoud |
| Giveaway deelnemen | Unieke entry, dubbelklik levert geen dubbele deelname |
| Giveaway onvoldoende deelnemers | Nul winnaars, geen verzonnen winnaar |
| Giveaway herstart/reroll | Nieuwe commitment, historie blijft, vorige winnaars uitgesloten bij reroll |
| Giveawaybewijs | Verifier klopt tegen oorspronkelijke commitment en snapshot |
| APV/regels publiceren/accepteren | Versienummer en juiste document-ID; nieuwe versie wist oude acceptatie niet |
| Evenement | Discord Scheduled Event, capaciteit, afmelden, reminder, start en sluiten |
| FiveM beschikbaar/onbereikbaar | Juiste echte aantallen of onbekend; geen IP/license-informatie |
| Interne staffwaarschuwing | Publiek kanaal geweigerd; reden alleen privé/intern |
| `/antinuke test` | Geen destructieve REST-call of productiehit |
| Auditthreshold in testguild | Exacte actor en entry-deduplicatie; toegestane actor alleen gelogd |
| Spam/mass-mentions in testguild | Bericht verwijderd/timeout indien rechten dat toelaten; fouten zichtbaar |
| Nieuwe niet-allowlisted testbot | Kick indien mogelijk; vertrouwde bot blijft |
| Outbox met ontbrekend Send Messages | Blijft pending; bezorgt na rechtenherstel zonder stilzwijgend verlies |
| Proces abrupt stoppen | Open actie uncertain; bans/draws/events/outbox herstellen zonder blind mutatieretry |
| Back-up en restore in testkopie | `quick_check=ok`, records behouden en geplande taken hervat |

Plan pas daarna productie. Anti-Nuke kan een object pas na een event beveiligen en kan hogere accounts/managed rollen niet controleren. Noteer afwijkingen met de echte Discord-foutcodes en deel geen token of webhook-URL's.
