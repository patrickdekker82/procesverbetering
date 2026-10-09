# Onderzoek: tekenmodule („Tekenen”) voor Verbeterlus

Datum: 9 oktober 2026. Doel: bepalen of een eigen tekenomgeving voor processen een goede en volwaardige aanvulling is, en zo ja, hoe die gebouwd wordt.

**Conclusie in één zin.** Ja, mits de tekening geen tweede waarheid wordt: het procesmodel blijft leidend, de tekening voegt alleen opmaak toe (posities, maten, bochten, notities). Gebouwd als uitbreiding van React Flow, dat de app al gebruikt, met een eigen laag voor uitlijnen, ongedaan maken en tekstschaling.

**Over de bronnen.** Versies, releasedata en licenties zijn gecontroleerd in het npm-register en, voor tldraw en bpmn-js, in het licentiebestand zelf. Veel websites (reactflow.dev, drawio.com, microsoft.com, omg.org) waren vanuit de bouwomgeving niet bereikbaar. Wat daarover hieronder staat, komt uit zoekresultaten en niet uit de volledige pagina's. De prijs van React Flow Pro en het zelf hosten van draw.io moeten vóór een definitief besluit nog een keer worden nagekeken.

---

## 1. Waarom het een volwaardige aanvulling is

Visio en draw.io tekenen beter dan deze app ooit zal doen. De meerwaarde zit in wat Visio níet kan, omdat de tekening hier direct het procesmodel is:

- **Live controle tijdens het tekenen.** Losse lijnen, een beslissing met één uitgang, een einde dat niet bereikbaar is: de app ziet het meteen en markeert de vorm.
- **Analyse op de tekening** (fase 4). De app kleurt per waardeklasse, toont badges voor bewerk- en wachttijd, markeert verspillingen en heuristieken op de betrokken stappen, en kan het kritieke pad tonen.
- **Kaizen-markering.** Je koppelt een verbetering aan een plek in het proces.
- **Huidige en gewenste situatie** naast elkaar, als versies van hetzelfde proces.
- **Eén plek.** Geïmporteerde Visio-, draw.io- en BPMN-bestanden openen in dezelfde editor en worden daar verder bewerkt.

## 2. Techniekkeuze

| Optie | Licentie (npm, 9-10-2026) | Geschiktheid | Oordeel |
| --- | --- | --- | --- |
| **React Flow uitbreiden** (`@xyflow/react` 12.12.0) | MIT | Goed. Wordt al gebruikt, stappen zijn 1-op-1 te koppelen, tekst is gewone HTML, werkt offline. | **Gekozen** |
| maxGraph (`@maxgraph/core` 0.25.0) | Apache-2.0 | Zeer goed (motor van draw.io). Wel een imperatieve API en nog versie 0.x. | Tweede keus |
| draw.io ingebouwd (iframe) | Apache-2.0 | De meeste functies voor de minste code. Wel zwaar (tientallen MB), Engelstalig, en zelf hosten in embed-modus wordt officieel niet ondersteund. | Afgevallen |
| bpmn-js 18.31.0 | MIT met verplicht bpmn.io-watermerk | Alleen BPMN-symbolen, geen Visio-gevoel | Afgevallen |
| JointJS core 4.3 | MPL-2.0 | Ongedaan maken en hulplijnen zitten alleen in de betaalde JointJS+ | Afgevallen |
| tldraw 5.5 | Eigen licentie: productiegebruik alleen met sleutel | Whiteboard, geen stroomschema-editor; licentierisico | Afgevallen |
| Excalidraw 0.18 | MIT | Getekende stijl, geen banen | Afgevallen |
| GoJS / yFiles | Commercieel | Uitstekend, maar duur | Afgevallen |
| Konva | MIT | Alles zelf bouwen, ook tekst | Afgevallen |

**Let op bij React Flow.** De voorbeelden voor ongedaan maken, kopiëren/plakken en hulplijnen zijn *Pro-voorbeelden* (betaald abonnement). We schrijven die onderdelen zelf (elk ±100–200 regels) en nemen geen Pro-code over. De React Flow-vermelding in de hoek blijft staan.

## 3. Symbolen

Een kleine, vertrouwde set in Visio-stijl (Basis-stroomdiagram en Stroomdiagram met zwembanen; ISO 5807). Elke vorm is óf een element van het model, óf uitdrukkelijk een notitie. Er komen geen vrije vormen zonder betekenis.

| Vorm | In het model | Soort |
| --- | --- | --- |
| Afgeronde eindvorm | START of EINDE | betekenis |
| Rechthoek | Taak | betekenis |
| Ruit | Beslissing (2 of meer uitgangen met label) | betekenis |
| Rechthoek met dubbele zijkanten | Taak met kenmerk *subproces* | betekenis |
| Document (golvende onderkant) | Taak met kenmerk *document* | betekenis |
| Handmatige invoer (schuine bovenkant) | Taak met kenmerk *handmatige invoer* | betekenis |
| Wachten (D-vorm of VSM-driehoek) | Wachtstap: telt als wachttijd in de analyse | betekenis |
| Database / gegevens | Systeem bij de verbonden taak | kenmerk |
| Notitie (haak) en vrije tekst | Niet in het model, niet in de analyse, niet naar AI | alleen visueel |
| Zwembaan (horizontaal) | Rol | betekenis |

Lean-praktijk: de wachtdriehoek is bewust opgenomen, omdat wachten precies is wat de analyse zoekt. De kaizen-markering volgt later, gekoppeld aan een verbetering.

## 4. Eisen aan de editor

**Moet (versie 1)**
- Vormen slepen uit het palet, of op het palet klikken om de vorm in het midden te plaatsen. Dat laatste is het niet-sleepalternatief.
- **Snel-toevoegen**: bij een geselecteerde vorm verschijnen pijltjes; een klik maakt de volgende vorm en verbindt die (zoals AutoConnect in Visio).
- Verbindingspunten (4 per vorm) met „lijm”: de lijn blijft vastzitten en kiest een andere kant als de vorm verschuift. Een lijn laten vallen op de vorm zelf hecht aan het dichtstbijzijnde punt.
- Rechthoekige (orthogonale) verbindingslijnen met labels (Ja/Nee) en kans.
- Uitlijnen op een raster van 10 px. **Hulplijnen** voor randen en middens van andere vormen hebben voorrang op het raster.
- Tekst direct in de vorm bewerken (dubbelklik, F2 of Enter). Bij het verkleinen of vergroten van een vorm loopt de tekst opnieuw door.
- Meerdere vormen selecteren (Shift-klik, lasso), verwijderen, kopiëren, plakken en dupliceren.
- Ongedaan maken en opnieuw doen voor alles, ook eigenschappen, rollen en labels (minstens 50 stappen).
- Zoomen, schuiven, passend maken.
- Zwembanen: toevoegen, hernoemen, volgorde wijzigen en hoogte aanpassen. Een vorm in een baan krijgt die rol; een vorm naar een andere baan slepen wijzigt de rol.
- Automatisch opslaan van het concept, herstellen na een crash, en waarschuwen bij weggaan.
- Live controle met een markering op de vorm. Een klik op de melding selecteert de vorm.
- Export naar PNG en SVG.

**Zou moeten**
- Knoppen voor uitlijnen en gelijk verdelen.
- **„Netjes zetten”**: de bestaande automatische opmaak uitvoeren.
- Sneltoetsenoverzicht en minikaart.
- PDF-export en handmatige knikpunten in lijnen.
- Export naar BPMN 2.0 (met coördinaten) en draw.io.

**Kan later**
- Thema's, fasescheiders, meerdere pagina's, lijnen die om vormen heen gaan (obstakelvermijding) en VSM-gegevensvakken.

## 5. Tekst in vormen

- **Eén lettergrootte voor de hele tekening** (13 px bij 100% zoom). De vorm groeit mee in hoogte, op de rastermaat. Wisselende lettergroottes lezen onrustig.
- Krimpen alleen als de vorm niet mag groeien, met een harde ondergrens van 10 px. Daaronder volgt afkappen met „…” en de volledige tekst als tooltip.
- **Bruikbaar tekstvlak**: de vorm min 8 px marge. Bij een ruit is dat de ingeschreven rechthoek (ongeveer de helft van breedte en hoogte). Bij een eindvorm gaan de ronde uiteinden eraf, bij een document de golf.
- **Meten** met `CanvasRenderingContext2D.measureText` in exact hetzelfde lettertype als op het scherm, ná `document.fonts.ready`. Afbreken op woorden; lange Nederlandse samenstellingen afbreken met `hyphens: auto` en `lang="nl"`. Bij meer dan 4 regels volgt de melding „label te lang”.
- Dit is een zuivere functie in `src/core`, getest op voorbeeldteksten.
- Contrast minstens 4,5:1, ook op de kleuren van de waardeklassen.
- Benoemingsadvies (als hulptekst): taken als werkwoord + object („Controleer aanvraag”), beslissingen als vraag, uitgangen als Ja/Nee.

## 6. Toegankelijkheid

- WCAG 2.2, criterium 2.5.7: elke sleepactie heeft een alternatief.
  - Klik op de bron en dan op het doel om te verbinden.
  - Pijltoetsen verschuiven een vorm één rastervak (Shift voor een fijnere stap).
  - Positie en maat zijn ook in het zijpaneel in te vullen.
- Tab en pijltoetsen gaan tussen vormen, met een duidelijke focusring en een `aria-label` per vorm.
- Schermteksten in het Nederlands, met Visio-termen: Vorm, Verbindingslijn, Zwembaan, Uitlijnen.

## 7. Grootste risico's en hoe die worden beperkt

| Risico | Maatregel |
| --- | --- |
| **Twee waarheden** (tekening wijkt af van model) | Het model is leidend. De opmaak wordt apart bewaard per stap-id. Elke tekenactie is een modelbewerking plus een opmaakbewerking. |
| Uitgroeien tot een algemeen tekenprogramma | Vaste symbolenset, geen vrije vormen of opmaak, harde lijst van wat moet en wat niet. |
| Lijnen om vormen heen leiden kost te veel tijd | Niet in versie 1. Eerst rechthoekige lijnen met handmatige knikpunten. |
| Ongedaan maken mist wijzigingen | Momentopnames van model + opmaak samen, met tests per soort wijziging. |
| Baanlidmaatschap en positie lopen uiteen (bekend probleem in Visio) | De rol volgt uit de baan waarin het midden van de vorm ligt, en wordt bij elke verplaatsing opnieuw bepaald. |
| Export ziet er anders uit dan het scherm (WKWebView) | Export-test op de Mac als handmatige controle; meten pas na het laden van het lettertype. |
| Concept gaat verloren | Apart conceptbestand dat automatisch wordt opgeslagen, los van de bevestigde versies. |
| Betaalde code ongemerkt overnemen | Geen React Flow Pro-voorbeelden, geen tldraw. Licenties vastgelegd in PLAN.md. |

## 8. Acceptatiecriteria

1. Alleen met het toetsenbord en snel-toevoegen: Start → 3 taken → beslissing (Ja/Nee) → 2 paden → Einde, binnen 2 minuten, zonder validatiefouten.
2. Een lijn blijft vastzitten als een vorm verschuift of van maat verandert, en kiest zo nodig een andere kant.
3. Een baan verplaatsen neemt de vormen mee. Een vorm naar een andere baan slepen wijzigt de rol in het model.
4. Een label van 120 tekens loopt door bij de vaste lettergrootte en de vorm groeit mee. In een ruit blijft de tekst binnen de ruit. Er is nooit tekst kleiner dan 10 px.
5. Ongedaan maken en opnieuw doen herstellen toevoegen, verwijderen, verplaatsen, label, baan en eigenschap, minstens 50 stappen, in de juiste volgorde.
6. De app afsluiten tijdens het tekenen geeft bij herstart „Concept herstellen?”, zonder verlies.
7. Een beslissing met één uitgang of een losse lijn geeft een Nederlandse melding op de vorm, en Bevestigen blijft uit. Een klik op de melding selecteert de vorm.
8. Een import (BPMN, draw.io, vsdx) openen, bewerken en bevestigen: stap-id's blijven gelijk, tijden blijven bewaard, posities overleven herladen.
9. Een notitie komt nooit in het model, de analyse of de AI-invoer.
10. Export naar PNG en SVG komt overeen met het scherm.
11. Elke sleepactie heeft een alternatief zonder slepen.

## Bronnen

Gecontroleerd in het npm-register (`npm view`): @xyflow/react, @maxgraph/core, bpmn-js (inclusief licentietekst), @joint/core, tldraw, @excalidraw/excalidraw, gojs, konva, elkjs.

Via zoekresultaten, niet volledig geopend:
- https://reactflow.dev/examples
- https://reactflow.dev/examples/interaction/undo-and-redo/
- https://pro.reactflow.dev/pricing
- https://reactflow.dev/attribution
- https://github.com/tldraw/tldraw/blob/main/LICENSE.md
- https://www.drawio.com/docs/reference/embed-mode/
- https://www.drawio.com/doc/faq/autosize
- https://support.microsoft.com/en-us/visio/create-a-cross-functional-flowchart-in-visio-for-the-web
- https://support.microsoft.com/en-us/visio/add-connectors-between-visio-shapes
- https://www.iso.org/standard/11955.html (ISO 5807)
- https://www.trisotech.com/bpmn-style-rules/
- https://www.allaboutlean.com/de/en-overview-of-value-stream-mapping-symbols/
- https://kb.daisy.org/publishing/docs/wcag/dragging-movements.html (WCAG 2.5.7)
