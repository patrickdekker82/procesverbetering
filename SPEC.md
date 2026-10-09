# Verbeterlus — specificatie versie 1

Verbeterlus is een lokale desktop-app voor continue procesverbetering. De app doet drie dingen:

1. **Verbetering beoordelen.** Een idee of probleem gaat door één vaste lus: scherpstellen, route kiezen, impact schatten, inspanning schatten, zekerheid vastleggen, indelen, stappenplan, meten en borgen.
2. **Proces analyseren.** Een proces (formulier, tekst of flowchart-bestand) wordt omgezet naar één intern procesmodel, als diagram getoond, door de gebruiker bevestigd en daarna geanalyseerd. Suggesties verwijzen naar processtappen en zijn gesplitst in *makkelijk* en *moeilijk*. Elke suggestie wordt met één klik een verbetering.
3. **Leren.** De app legt uitkomsten en reacties vast en gebruikt die om volgende schattingen en suggesties te verbeteren. Er wordt geen model getraind.

Dit document is op zichzelf staand. Bij twijfel geldt: Claude schat, code rekent.

---

## 1. Uitgangspunten uit het interview

| Onderwerp | Besluit |
| --- | --- |
| Soort processen | Kantoor/administratie en klantprocessen/service. Het domein moet uitbreidbaar blijven: de regelbank, de trefwoorden en de sjablonen zijn data, en er is een veld `domein` op proces en verbetering (standaard `KANTOOR`, `KLANT`; later uit te breiden). |
| Gebruikers | Eén gebruiker op één computer. Delen kan later; daarom heeft elke tabel een UUID als sleutel (geen oplopende nummers) en kan een verbetering of casus als JSON worden geëxporteerd en geïmporteerd. |
| Platform | macOS. Ontwikkeling gebeurt deels in een Linux-omgeving; alle kernlogica is los van Tauri te testen. |
| Flowchart-bestanden | Visio (`.vsdx` direct, plus PDF/PNG-export), draw.io, BPMN 2.0 (industriestandaard), Mermaid, Excel/CSV-stappenlijst, Word (`.docx`), vrije tekst, afbeelding/PDF. |
| Word/Excel | Excel/CSV via een vast sjabloon zonder AI; Word via tekstextractie en daarna Claude; plakken van tekst kan altijd. |
| Privacy | Procesgegevens mogen naar de Claude API, **met waarschuwing**: vóór de eerste AI-aanroep voor een proces of verbetering toont de app één keer per item welke gegevens verstuurd worden. Een algemene toestemming staat in Instellingen en kan worden ingetrokken; zonder toestemming zijn alle AI-knoppen uitgeschakeld en werkt de rest van de app gewoon. |
| Uurtarief | Standaard € 75, aan te passen in Instellingen. |
| Taal | Schermteksten Nederlands; code, namen en commits Engels. |

---

## 2. Schermen

Navigatie links: **Verbeteringen**, **Processen**, **Geleerd**, **Instellingen**. Bovenaan een melding als er geen API-sleutel of geen toestemming is.

### 2.1 Verbeteringen

- **Overzichtsbord** met kolommen per status: IDEE, BEOORDEELD, LOOPT, METEN, GEBORGD, AFGEWEZEN. Kaart toont titel, route, kwadrant, prioriteitsscore. Filter op kwadrant, route en domein; sorteren op prioriteit of datum. Status wijzigen via een keuzelijst op de kaart (geen slepen in v1).
- **Nieuw idee**: titel, vrije beschrijving, domein, optioneel gekoppeld proces en stappen.
- **Scherpstellen**: Claude stelt maximaal vijf vragen, één voor één, elk met een toelichting waarom. De gebruiker antwoordt of slaat over. Claude geeft na elk antwoord óf een volgende vraag óf een probleemstelling (wat gaat mis, hoe vaak, wat kost het, voor wie). De gebruiker kan de probleemstelling bewerken. Na vijf vragen stopt het doorvragen altijd.
- **Beoordeling**:
  - de vier route-antwoorden en het probleemtype (door Claude ingevuld, met onderbouwing, te overschrijven);
  - de gekozen route met de regel uit de beslistabel die de keuze bepaalde;
  - impact per dimensie (−2..+2) met onderbouwing;
  - jaaropbrengst met zichtbare rekensom;
  - inspanning per onderdeel;
  - zekerheid;
  - impactscore, inspanningsscore, prioriteit en kwadrant, elk met de rekensom;
  - waar een correctiefactor geldt: ruwe en gecorrigeerde waarde naast elkaar, of de tekst „nog te weinig data”.
  Elke schatting heeft een potloodknop; een overschrijving vraagt om een korte reden (optioneel) en wordt bewaard als leersignaal.
- **Stappenplan**: sjabloon van de route, door Claude ingevuld. Tabel met wat, eigenaar, datum, op te leveren resultaat, status (open/klaar). Daarboven: meetwaarde, eenheid, nulmeting, doel, meetmoment. Rijen toevoegen, verwijderen, verschuiven.
- **Afronden** (bij overgang naar GEBORGD of AFGEWEZEN): werkelijke impact per dimensie, werkelijke jaaropbrengst, werkelijke uren en kosten, gemeten eindwaarde, lessen in vrije tekst, labels. Dit maakt er een casus van.

### 2.2 Processen

- **Lijst** van processen met naam, domein, bron (formulier, tekst, BPMN, …), aantal stappen, laatste analyse.
- **Proces invoeren**, tabbladen:
  - *Formulier*: tabel met stappen (naam, type, rol, systeem, bewerktijd, wachttijd, frequentie, foutpercentage, waardeklasse) en volgende stap(pen) met label/kans;
  - *Tekst*: plakveld, Claude zet om;
  - *Bestand*: slepen of kiezen; herkent `.bpmn`/`.xml` (BPMN), `.drawio`/`.xml` (draw.io), `.mmd`/`.md`/`.txt` met Mermaid, `.vsdx`, `.xlsx`/`.csv`, `.docx`, `.png`/`.jpg`/`.pdf`. Het formaat wordt aan de inhoud herkend, niet alleen aan de extensie.
  - Onder de invoer staat de betrouwbaarheid van de gekozen route (hoog/wisselend) en bij AI-invoer de privacymelding.
- **Diagram** (@xyflow/react): automatische opmaak van links naar rechts, banen per rol, stappen gekleurd naar waardeklasse. Bewerken: stap toevoegen, verwijderen, hernoemen, type wijzigen, verbinden, verbinding verwijderen, label en kans op een verbinding, eigenschappen in een zijpaneel. Validatiefouten en -waarschuwingen staan in een paneel; klikken selecteert de betreffende stap. Knop **Bevestigen** is pas actief zonder validatiefouten. Een bevestigd model wordt als nieuwe versie opgeslagen; wijzigen na bevestiging maakt een nieuwe versie.
- **Tijden aanvullen**: ontbreken bewerk- of wachttijden, dan vraagt de app voor hooguit vijf stappen een schatting (de stappen op het langste pad met de meeste ontbrekende velden eerst) en toont daarna: „Analyse is kwalitatief: tijden ontbreken voor N stappen.”
- **Analyse**: kengetallen (tabel), regeltreffers (lijst, per regel de stappen), suggesties in twee kolommen **Makkelijk** en **Moeilijk**. Hover of klik op een suggestie markeert de betrokken stappen in het diagram. Per suggestie: Accepteren, Aanpassen (titel/uitleg/inspanning bewerken), Afwijzen (met reden, verplicht een keuze uit: past niet, al geprobeerd, te duur, klopt niet, anders + vrije tekst), en **Maak verbetering**.

### 2.3 Geleerd („Wat heeft de app geleerd”)

- Correctiefactoren per route voor impact en inspanning: aantal casussen, ruwe factor, gedempte factor, of „nog te weinig data (n van 5)”.
- Trefkans per regel: geaccepteerd/aangepast/afgewezen, trefkans, meest genoemde afwijsreden.
- Draaiboek: lessen met status VOORGESTELD, ACTIEF, UIT; bewerken, goedkeuren, uitzetten; knop „Stel lessen voor” (Claude, op basis van de laatste 20 casussen).
- Casusbibliotheek: zoeken (full-text en labels), casus openen.
- Promptkwaliteit: per prompt-id de versies met evaluatiescore (nep en live), datum en welke versie actief is.
- Overschrijvingen: aantal per veld en gemiddelde afwijking.

### 2.4 Instellingen

API-sleutel (invoeren, vervangen, verwijderen; nooit tonen), knop **Test verbinding**, model (standaard `claude-opus-5-5`, keuzelijst opgehaald via de Models API met handmatige invoer als terugval), toestemming voor AI, uurtarief, drempels en factoren uit §6, minimum casussen en demping uit §8, back-up maken en terugzetten, voorbeeldgegevens laden/verwijderen.

---

## 3. Procesmodel (TypeScript)

Alle invoer wordt omgezet naar dit model. Tijden in **minuten**, frequenties **per jaar**, foutpercentage als fractie 0..1.

```ts
// src/core/model/types.ts
export type StepType = 'START' | 'END' | 'TASK' | 'DECISION';
export type ValueClass = 'CUSTOMER' | 'BUSINESS' | 'NONE'; // klantwaarde, bedrijfsnoodzakelijk, geen waarde
export type Domain = 'KANTOOR' | 'KLANT' | (string & {});
export type SourceFormat =
  | 'FORM' | 'TEXT' | 'BPMN' | 'DRAWIO' | 'MERMAID' | 'VSDX' | 'TABLE' | 'DOCX' | 'IMAGE' | 'PDF';

export interface Role { id: string; name: string }

export interface Step {
  id: string;                 // stabiel binnen het model; parsers bewaren de bron-id waar die bestaat
  type: StepType;
  name: string;
  roleId?: string;
  system?: string;
  processingTime?: number;    // bewerktijd per keer, minuten
  waitingTime?: number;       // wachttijd vóór deze stap, minuten
  frequency?: number;         // aantal keer per jaar
  errorRate?: number;         // 0..1
  valueClass?: ValueClass;
  isControl?: boolean;        // controle- of goedkeuringsstap; leeg = afleiden uit naam (§5.1)
  notes?: string;
  source?: { format: SourceFormat; ref?: string }; // herkomst voor foutmeldingen
}

export interface Flow {
  id: string;
  from: string;               // Step.id
  to: string;                 // Step.id
  label?: string;
  probability?: number;       // 0..1, alleen zinvol na een DECISION
}

export interface ProcessModel {
  id: string;
  name: string;
  domain: Domain;
  volumePerYear?: number;     // aantal zaken per jaar
  roles: Role[];
  steps: Step[];
  flows: Flow[];
}

export type IssueSeverity = 'ERROR' | 'WARNING';
export interface ValidationIssue {
  code: string;               // bv. 'NO_START', 'MULTIPLE_START', 'UNREACHABLE_END', 'DANGLING_FLOW'
  severity: IssueSeverity;
  message: string;            // Nederlands
  stepIds: string[];
  flowIds: string[];
}
export interface ValidationResult { valid: boolean; issues: ValidationIssue[] }
```

Opmerkingen: een BPMN-gateway wordt `DECISION` (ook parallelle gateways; het type van de gateway wordt in `notes` bewaard en een parallelle splitsing krijgt geen kansen). Subprocessen worden in v1 als één `TASK` ingelezen met een waarschuwing.

### 3.1 Modelvalidatie (`validateModel`)

Fouten (blokkeren bevestigen):

| Code | Regel |
| --- | --- |
| `NO_START` / `MULTIPLE_START` | Precies één stap van type START. |
| `NO_END` | Minstens één END. |
| `DANGLING_FLOW` | Elke flow verwijst naar bestaande stappen. |
| `DUPLICATE_ID` | Stap-, flow- en rol-id's zijn uniek. |
| `UNREACHABLE_STEP` | Elke stap is bereikbaar vanaf START. |
| `END_UNREACHABLE` | Elke END is bereikbaar vanaf START. |
| `DEAD_END` | Elke niet-END stap heeft een uitgaande flow. |
| `START_HAS_INCOMING` / `END_HAS_OUTGOING` | START heeft geen inkomende, END geen uitgaande flows. |
| `UNKNOWN_ROLE` | `roleId` bestaat in `roles`. |
| `INVALID_NUMBER` | Tijden en frequenties ≥ 0, foutpercentage en kans in 0..1. |

Waarschuwingen: `DECISION_SINGLE_EXIT` (beslissing met één uitgang), `PROBABILITY_SUM` (kansen na een beslissing tellen niet op tot 1 ± 0,01), `NO_PATH_TO_END` (stap van waaruit geen END bereikbaar is), `MISSING_TIMES` (tijden ontbreken), `EMPTY_NAME`.

Geen enkele invoerroute slaat een model op dat niet door de validatie is gegaan. Een model met fouten kan wel als **concept** in het diagramscherm staan, maar wordt niet als versie bevestigd.

---

## 4. Invoerroutes

| Formaat | Module | Methode | Betrouwbaarheid |
| --- | --- | --- | --- |
| Formulier | `src/core/import/form.ts` | rijen → model | hoog |
| BPMN 2.0 XML | `src/core/import/bpmn.ts` | `bpmn-moddle`: `startEvent`→START, `endEvent`→END, `task`/`userTask`/`serviceTask`/…→TASK, `*Gateway`→DECISION, `sequenceFlow`→Flow, `lane`→Role (via `flowNodeRef`), meerdere `participant`s → rol per pool | hoog |
| draw.io | `src/core/import/drawio.ts` | eigen parser op `mxGraphModel`; ondersteunt ongecomprimeerde én gecomprimeerde diagrammen (base64 + raw deflate + URI-encoding). Vormtype geraden uit `style` (`ellipse`→START/END, `rhombus`→DECISION, swimlane-containers→Role, anders TASK). Start = ellips zonder inkomende rand; einde = ellips zonder uitgaande rand. | hoog voor structuur |
| Mermaid | `src/core/import/mermaid.ts` | eigen parser voor `flowchart`/`graph` met richting, knopen `A[..]`, `A(..)`, `A([..])`, `A{..}`, `A((..))`, randen `-->`, `---`, `-.->`, `==>`, labels `-->|x|` en `-- x -->`, ketens `A --> B --> C`, `subgraph` → Role. `A([..])`/`A((..))` zonder inkomend → START, zonder uitgaand → END; `{}` → DECISION. Onbekende regels → foutmelding met regelnummer. | hoog |
| Visio `.vsdx` | `src/core/import/vsdx.ts` | zip openen, `visio/pages/page1.xml` (keuze bij meerdere pagina's), `Shape`s en `Connect`s lezen, mastervorm via `visio/masters/*.xml` (naam bevat „Decision”/„Beslissing” → DECISION, „Start/End”/„Terminator” → START/END, swimlane/„Functional band” → Role). Afbeeldingen en containers zonder verbindingen worden genegeerd met waarschuwing. | hoog voor structuur |
| Excel/CSV | `src/core/import/table.ts` | sjabloon met kolommen `id, stap, type, rol, systeem, bewerktijd_min, wachttijd_min, frequentie_per_jaar, foutpercentage, waardeklasse, volgende` (volgende = `id` of `id:label:kans` gescheiden door `;`). Ontbreken START/END, dan voegt de parser ze toe vóór de eerste en na de laatste stap zonder opvolger, met waarschuwing. Kolomnamen hoofdletterongevoelig, Nederlandse en Engelse aliassen. | hoog |
| Word `.docx` | `src/core/import/docx.ts` + AI | tekst eruit halen, daarna als vrije tekst naar Claude | goed, controleren |
| Vrije tekst | `src/ai` | Claude → `ProcessExtraction` (§7.5) | goed, controleren |
| Afbeelding/PDF | `src/ai` | Claude leest het beeld → `ProcessExtraction` | wisselend, altijd controleren |

Alle parsers zijn pure functies `parseX(input: string | Uint8Array): ImportResult` met

```ts
export type ImportResult =
  | { ok: true; model: ProcessModel; warnings: string[]; validation: ValidationResult }
  | { ok: false; error: { code: string; message: string; detail?: string } };
```

Een parser gooit nooit een exceptie naar het scherm: alles wordt opgevangen en omgezet in `ok: false` met een Nederlandse melding („Dit bestand lijkt geen BPMN 2.0 te zijn: geen <definitions> gevonden.”). AI-uitkomsten gaan door `extractionToModel()` en daarna door `validateModel()`.

---

## 5. Procesanalyse in drie lagen

### 5.1 Kengetallen (code, `src/core/analysis/metrics.ts`)

Voorbewerking: de **taakgraaf** verbindt elke TASK met de eerstvolgende TASKs, waarbij DECISION-knopen worden overgeslagen. Terugverbindingen (*back edges*) worden gevonden met een diepte-eerst-zoektocht vanaf START, met kinderen in de volgorde van `flows`. De **acyclische graaf** is de graaf zonder terugverbindingen.

| Kengetal | Definitie |
| --- | --- |
| `stepCount` | aantal TASKs |
| `handoffs` | aantal paren (a→b) in de taakgraaf waarbij beide een rol hebben en de rollen verschillen |
| `systemSwitches` | idem voor `system` |
| `loops` | aantal terugverbindingen |
| `reworkStepIds` | TASKs die op een cyclus liggen |
| `controlStepIds` | TASKs met `isControl === true`, of met `isControl` leeg en een naam die (hoofdletterongevoelig) een trefwoord bevat: controle, controleer, check, toets, beoordeel, goedkeur, akkoord, accordeer, verifieer, valideer, review, aftekenen |
| `criticalPath` | stap-id's van START naar een END in de acyclische graaf met de grootste som van `processingTime + waitingTime` (ontbrekend = 0); bij gelijke som het pad met de meeste stappen, daarna lexicografisch op id |
| `leadTime` | som van `processingTime + waitingTime` over `criticalPath` |
| `processingTimeTotal` | som van `processingTime` over `criticalPath` |
| `flowEfficiency` | `processingTimeTotal / leadTime`; `null` als `leadTime = 0` |
| `bottleneckStepId` | TASK met de hoogste `waitingTime`; bij gelijkspel de hoogste `processingTime × (frequency ?? 1)`; `null` als geen enkele TASK een tijd heeft |
| `timesComplete` | aandeel TASKs met zowel bewerk- als wachttijd |
| `qualitative` | `true` als `timesComplete < 1` |

Lussen worden niet meegeteld in `leadTime`; ze staan apart bij `loops`.

### 5.2 Regelbank (code + data, `src/core/rules/`)

De regelbank is een array van `Rule`-objecten in `src/core/rules/bank.ts`. De herkenningscondities staan in `src/core/rules/detectors.ts`, gekoppeld via `detectorId`.

```ts
export type RuleKind = 'WASTE' | 'VALUE' | 'HEURISTIC';
export type Dimension = 'time' | 'cost' | 'quality' | 'flexibility';
export type Effect = -1 | 0 | 1;                       // −, 0, +
export type Effort = 'LOW' | 'MEDIUM' | 'HIGH';
export type Preference = 'ELIMINATE' | 'SIMPLIFY' | 'COMBINE' | 'AUTOMATE' | 'OTHER';

export interface Rule {
  id: string;                    // bv. 'H_KNOCK_OUT', 'W_WAITING', 'V_NONE'
  kind: RuleKind;
  nameNl: string;
  nameEn?: string;               // originele naam bij heuristieken
  explanationNl: string;
  detection:
    | { type: 'code'; detectorId: string; params?: Record<string, number> }
    | { type: 'question'; questionNl: string };      // gaat als vraag naar de oordeelslaag
  effects: Record<Dimension, Effect>;                 // startwaarden, leerlus mag bijstellen
  typicalEffort: Effort;
  preference: Preference;
  domains?: Domain[];            // leeg = alle domeinen
}

export interface RuleHit { ruleId: string; stepIds: string[]; evidenceNl: string }
```

Inhoud:

- **8 verspillingen** (kantoorvertaling): transport (overdrachten van dossiers/documenten tussen rollen), voorraad (werk dat wacht in bakjes/wachtrijen), beweging (systeemwissels, zoeken naar informatie), wachten (wachttijd), overproductie (meer doen of maken dan nodig, rapporten die niemand leest), overbewerking (dubbele controles, overbodige goedkeuring), fouten (herwerk, foutpercentage), onbenut talent (specialist doet routinewerk).
- **3 waardeklassen**: klantwaarde, bedrijfsnoodzakelijk, geen waarde. Een stap zonder `valueClass` krijgt een vraag in de oordeelslaag.
- **29 heuristieken** van Reijers en Limam Mansar (2005): control relocation, contact reduction, integration, order types, task elimination, order-based work, triage, task composition, resequencing, knock-out, parallelism, exception, order assignment, flexible assignment, centralization, split responsibilities, customer teams, numerical involvement, case manager, extra resources, specialist-generalist, empower, control addition, buffering, task automation, integral technology, trusted party, outsourcing, interfacing.

Detectoren in code (de rest is `question`). Drempels zijn `params` met standaardwaarde:

| Detector | Regel(s) | Raakt als |
| --- | --- | --- |
| `waitingDominant` | W_WAITING, H_ORDER_BASED_WORK | `waitingTime ≥ 2 × processingTime` en `waitingTime > 0` |
| `manyHandoffs` | W_TRANSPORT, H_CASE_MANAGER, H_NUMERICAL_INVOLVEMENT | `handoffs ≥ 3` (case manager) of aantal rollen ≥ 4 (numerical involvement); stap-id's = stappen aan weerszijden van de overdrachten |
| `systemSwitches` | W_MOTION, H_INTEGRAL_TECHNOLOGY | `systemSwitches ≥ 2` |
| `reworkLoop` | W_DEFECTS, H_CONTROL_ADDITION | er is een terugverbinding; of een stap met `errorRate ≥ 0,1` zonder controle-stap ná die stap op hetzelfde pad |
| `lateKnockOut` | H_KNOCK_OUT, H_RESEQUENCING | een controle-stap direct gevolgd door een DECISION met een uitgang naar END, terwijl vóór de controle op het kritieke pad ≥ 2 TASKs liggen |
| `consecutiveSameRole` | H_TASK_COMPOSITION | twee opeenvolgende TASKs in de taakgraaf (enige opvolger/enige voorganger) met dezelfde rol |
| `consecutiveDifferentRoles` | H_PARALLELISM (kandidaat) | twee opeenvolgende TASKs zonder beslissing ertussen met verschillende rol; de oordeelslaag beslist of ze onafhankelijk zijn |
| `noValueStep` | V_NONE, H_TASK_ELIMINATION | `valueClass === 'NONE'` |
| `duplicateControl` | W_OVERPROCESSING, H_TASK_ELIMINATION | ≥ 2 controle-stappen op hetzelfde pad |
| `approvalByOtherRole` | H_EMPOWER | controle-stap waarvan de rol verschilt van de rol van de voorgaande TASK |
| `bottleneck` | H_EXTRA_RESOURCES, H_FLEXIBLE_ASSIGNMENT | `bottleneckStepId` bestaat |
| `manualHighVolume` | H_TASK_AUTOMATION | `frequency ≥ 1000` en `processingTime ≥ 5` en geen `system` |
| `customerContacts` | H_CONTACT_REDUCTION | ≥ 2 TASKs met een rol waarvan de naam klant/aanvrager/burger/customer bevat |

**Startwaarden van effecten.** Bij het vullen van de bank (fase 4) worden de effecten per heuristiek overgenomen uit de kwalitatieve beschrijving in Reijers en Limam Mansar (2005). Waar die niet in de repo te controleren is, krijgt de regel `effects` op 0 en `verified: false` in een opmerking, en toont de app „effect onbekend”. Er worden geen cijfers en geen bronnen verzonnen.

### 5.3 Oordeel (Claude, `src/ai`)

Invoer: procesmodel (JSON), kengetallen, regeltreffers, open `question`-regels, maximaal 3 vergelijkbare casussen, actieve lessen. Uitvoer: `ProcessSuggestions` (§7.6).

Controle door code (`validateSuggestions`):
- elke `stepIds[i]` bestaat in het model → anders wordt de suggestie geweigerd;
- `ruleId` bestaat in de regelbank → anders geweigerd;
- minstens één stap-id;
- geweigerde suggesties worden niet getoond maar wel gelogd (aantal zichtbaar onder de lijst).

Indeling: **makkelijk** als `effort === 'LOW'`, of `effort === 'MEDIUM'` en `itRequired === false`; anders **moeilijk**.
Volgorde binnen een groep: aflopend op `preferenceWeight × hitRate`, met `preferenceWeight` ELIMINATE 1,0 · SIMPLIFY 0,9 · COMBINE 0,8 · OTHER 0,75 · AUTOMATE 0,7, en `hitRate` uit §8.2. Bij gelijke waarde: volgorde van Claude.

---

## 6. Beoordeling van een verbetering: formules

Alle functies staan in `src/core/assessment/` en zijn puur. Instellingen (`Settings`) worden als argument meegegeven.

### 6.1 Route-keuze (`chooseRoute`)

Invoer (door Claude geschat, door gebruiker te overschrijven):

```ts
interface RouteInputs {
  causeKnown: 'YES' | 'PARTLY' | 'NO';
  scope: 'SMALL_REVERSIBLE' | 'MEDIUM' | 'LARGE_IRREVERSIBLE';
  hasData: boolean;                       // is er meetdata
  departments: number;                    // aantal geraakte afdelingen, ≥ 1
  problemType: 'INCIDENT' | 'RECURRING' | 'VARIATION' | 'BOTTLENECK' | 'STRUCTURE';
}
```

`problemType` is een vijfde invoer naast de vier vragen uit de opdracht. Zonder dat veld zijn KNELPUNT en HERONTWERP niet te onderscheiden.

Beslistabel, eerste regel die past wint:

| # | Voorwaarde | Route |
| --- | --- | --- |
| R1 | `problemType = BOTTLENECK` | KNELPUNT |
| R2 | `problemType = STRUCTURE` of (`departments ≥ 4` en `scope = LARGE_IRREVERSIBLE`) | HERONTWERP |
| R3 | `problemType = VARIATION` en `hasData` en `scope ≠ SMALL_REVERSIBLE` | MEETPROJECT |
| R4 | `causeKnown = YES` en `scope = SMALL_REVERSIBLE` | SNELLE_WINST |
| R5 | `causeKnown ≠ YES` | OORZAAK_ZOEKEN |
| R6 | `hasData` en `scope = LARGE_IRREVERSIBLE` | MEETPROJECT |
| R7 | anders | SNELLE_WINST |

De uitkomst bevat het regelnummer, zodat het scherm kan tonen waarom.

### 6.2 Impact

Per dimensie `s_d ∈ {−2,…,+2}`, gewichten `w_d` (standaard 1).

```
I_dim   = 10 × max(0, Σ w_d·s_d) / (2 × Σ w_d)                    // 0..10
J       = frequentiePerJaar × tijdwinstPerKeer_min / 60 × uurtarief + vermedenFoutkostenPerJaar
I_geld  = band(J): < 1.000 → 0 · < 5.000 → 2,5 · < 20.000 → 5 · < 50.000 → 7,5 · ≥ 50.000 → 10
I       = J bekend ? max(I_dim, I_geld) : I_dim
```

De rekensom van J wordt letterlijk getoond: „1.200 × 15 min ÷ 60 × € 75 + € 2.000 = € 24.500”. Bandgrenzen zijn instellingen.

### 6.3 Inspanning

| Onderdeel | Punten |
| --- | --- |
| uren | < 8 → 0 · < 40 → 1 · < 160 → 2 · ≥ 160 → 3 |
| kosten (€) | < 1.000 → 0 · < 10.000 → 1 · < 50.000 → 2 · ≥ 50.000 → 3 |
| afdelingen | 1 → 0 · 2–3 → 1 · ≥ 4 → 2 |
| IT-afhankelijkheid | NONE 0 · LIGHT 1 · HEAVY 2 |
| gedragsverandering | LOW 0 · MEDIUM 1 · HIGH 2 |
| omkeerbaarheid | EASY 0 · HARD 1 · IRREVERSIBLE 2 |

```
P = som van de punten (0..14)
E = 1 + 9 × P / 14                                               // 1..10
```

### 6.4 Zekerheid, prioriteit, kwadrant

```
z = GEMETEN 1,0 · GESCHAT 0,8 · GEVOEL 0,5                      // instellingen
prioriteit = I × z / E                                           // afgerond op 2 decimalen voor weergave
impactHoog      = I ≥ impactDrempel        (standaard 5)
inspanningHoog  = E ≥ inspanningDrempel    (standaard 5)
DOEN      = impactHoog ∧ ¬inspanningHoog
PROJECT   = impactHoog ∧ inspanningHoog
MEENEMEN  = ¬impactHoog ∧ ¬inspanningHoog
NIET_DOEN = ¬impactHoog ∧ inspanningHoog
```

Grenzen zijn inclusief (`≥`): I = 5 is hoog, E = 5 is hoog. Is een correctiefactor actief (§8.1), dan worden I en E eerst gecorrigeerd (`I' = min(10, I × f_I)`, `E' = clamp(E × f_E, 1, 10)`) en worden beide uitkomsten getoond. Het kwadrant en de prioriteit gebruiken de gecorrigeerde waarden.

### 6.5 Stappenplan-sjablonen (`src/core/templates/`)

Elk sjabloon is een lijst fasen met standaardstappen. Elke stap: `what`, `owner`, `dueDate`, `deliverable`, `done`. Elk plan: `metric`, `unit`, `baseline`, `target`, `measureMoment`.

| Route | Fasen |
| --- | --- |
| SNELLE_WINST | Plan · Do · Check · Act |
| OORZAAK_ZOEKEN | A3: Achtergrond · Huidige situatie · Doel · Oorzaakanalyse (5× waarom, visgraat met 6 categorieën: mens, methode, middelen, materiaal, meting, omgeving) · Tegenmaatregelen, daarna PDCA |
| MEETPROJECT | Define · Measure · Analyze · Improve · Control |
| KNELPUNT | Identificeer · Benut maximaal · Ondergeschikt maken · Verhoog capaciteit · Herhaal |
| HERONTWERP | Heuristieken kiezen · per wijziging één PDCA-blok |

Voor OORZAAK_ZOEKEN slaat de app ook de 5× waarom (lijst van vraag-antwoord) en de visgraat (oorzaken per categorie) op.

---

## 7. AI-module en Zod-schema's

### 7.1 Opbouw

```ts
// src/ai/types.ts
export interface AiClient {
  testConnection(): Promise<{ ok: true; model: string } | { ok: false; error: AiError }>;
  clarify(input: ClarifyInput): Promise<AiResult<Clarification>>;
  estimate(input: EstimateInput): Promise<AiResult<Estimation>>;
  plan(input: PlanInput): Promise<AiResult<ActionPlanDraft>>;
  extractProcess(input: ExtractInput): Promise<AiResult<ProcessExtraction>>;   // tekst, docx-tekst, afbeelding, pdf
  suggest(input: SuggestInput): Promise<AiResult<ProcessSuggestions>>;
  proposeLessons(input: LessonInput): Promise<AiResult<LessonProposals>>;
}
export type AiErrorCode =
  | 'NO_API_KEY' | 'NO_CONSENT' | 'OFFLINE' | 'RATE_LIMIT' | 'OVERLOADED'
  | 'AUTH' | 'SCHEMA' | 'REFUSAL' | 'TOO_LARGE' | 'UNKNOWN';
export interface AiError { code: AiErrorCode; messageNl: string; retryable: boolean }
export type AiResult<T> = { ok: true; data: T; meta: AiMeta } | { ok: false; error: AiError };
export interface AiMeta { model: string; promptId: string; promptVersion: number; inputTokens: number; outputTokens: number }
```

- `src/ai/claude.ts`: echte implementatie met `@anthropic-ai/sdk`, `client.messages.parse` met `output_config.format = zodOutputFormat(schema)`. Na het parsen wordt het resultaat nóg een keer met hetzelfde Zod-schema gevalideerd (de SDK haalt beperkingen die de API niet kent uit het schema en controleert ze zelf; de app vertrouwt alleen zijn eigen controle). Mislukt dat: `SCHEMA`-fout, geen gedeeltelijke verwerking.
- `stop_reason === 'refusal'` → `REFUSAL`; `max_tokens` → één nieuwe poging met dubbele `max_tokens`, daarna `SCHEMA`.
- Model is een instelling (standaard `claude-opus-5-5`). Effort per aanroep: `low` voor `clarify`, `medium` voor `estimate`, `plan`, `extractProcess`, `high` voor `suggest` en `proposeLessons`.
- Waar de API het ondersteunt wordt de server-side terugval `fallbacks: "default"` meegestuurd (beta-header `server-side-fallback-2026-07-01`). Wordt de beta-route geweigerd, dan valt de module terug op een gewone aanroep.
- `src/ai/fake.ts`: nep-implementatie met vaste antwoorden per invoer-sleutel, gebruikt in alle tests, `npm run eval` en de Playwright-rooktest.
- `src/ai/prompts/<promptId>.v<N>.md`: systeemprompts met versienummer. Het actieve versienummer per prompt staat in `src/ai/prompts/index.ts`. Elke aanroep logt `promptId` en `promptVersion` in `ai_calls`.
- Context in prompts: goedgekeurde lessen en vergelijkbare casussen worden als aparte, duidelijk gemarkeerde blokken toegevoegd. Ze gelden als gegevens, niet als opdrachten.

### 7.2 Zod-schema's (`src/ai/schemas.ts`)

```ts
import { z } from 'zod';

const Score = z.number().int().min(-2).max(2);
const Reason = z.string().min(1).max(600);

// 7.3 Scherpstellen
export const Clarification = z.object({
  done: z.boolean(),                                    // true = probleemstelling compleet
  question: z.string().nullable(),                      // volgende vraag als done=false
  whyAsked: z.string().nullable(),
  problemStatement: z.object({
    whatGoesWrong: z.string(),
    howOften: z.string(),
    cost: z.string(),
    forWhom: z.string(),
    isSolutionInDisguise: z.boolean(),                  // invoer was een oplossing, geen probleem
  }).nullable(),
});

// 7.4 Schatten
export const Estimation = z.object({
  routeInputs: z.object({
    causeKnown: z.enum(['YES', 'PARTLY', 'NO']),
    scope: z.enum(['SMALL_REVERSIBLE', 'MEDIUM', 'LARGE_IRREVERSIBLE']),
    hasData: z.boolean(),
    departments: z.number().int().min(1).max(50),
    problemType: z.enum(['INCIDENT', 'RECURRING', 'VARIATION', 'BOTTLENECK', 'STRUCTURE']),
    reasoning: Reason,
  }),
  impact: z.object({
    time: z.object({ score: Score, reason: Reason }),
    cost: z.object({ score: Score, reason: Reason }),
    quality: z.object({ score: Score, reason: Reason }),
    flexibility: z.object({ score: Score, reason: Reason }),
  }),
  annualBenefit: z.object({
    frequencyPerYear: z.number().min(0).nullable(),
    minutesSavedPerOccurrence: z.number().min(0).nullable(),
    avoidedErrorCostPerYear: z.number().min(0).nullable(),
    reason: Reason,
  }),
  effort: z.object({
    hours: z.number().min(0),
    costEur: z.number().min(0),
    departments: z.number().int().min(1),
    itDependency: z.enum(['NONE', 'LIGHT', 'HEAVY']),
    behaviourChange: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    reversibility: z.enum(['EASY', 'HARD', 'IRREVERSIBLE']),
    reason: Reason,
  }),
  certainty: z.enum(['GEMETEN', 'GESCHAT', 'GEVOEL']),
  certaintyReason: Reason,
  category: z.string(),                                 // vrij label, bv. 'formulieren', 'goedkeuring'
});

// 7.5 Stappenplan
export const ActionPlanDraft = z.object({
  metric: z.string(), unit: z.string(),
  baseline: z.number().nullable(), target: z.number().nullable(),
  measureMoment: z.string(),
  steps: z.array(z.object({
    phase: z.string(),                                  // moet een fase uit het sjabloon zijn
    what: z.string(), owner: z.string(),
    dueInDays: z.number().int().min(0).max(730),        // code rekent om naar datum
    deliverable: z.string(),
  })).min(1).max(30),
  fiveWhys: z.array(z.object({ why: z.string(), answer: z.string() })).max(5).nullable(),
  fishbone: z.record(
    z.enum(['MENS', 'METHODE', 'MIDDELEN', 'MATERIAAL', 'METING', 'OMGEVING']),
    z.array(z.string()),
  ).nullable(),
});

// 7.6 Proces uit tekst, docx, afbeelding of pdf
export const ProcessExtraction = z.object({
  name: z.string(),
  roles: z.array(z.object({ id: z.string(), name: z.string() })),
  steps: z.array(z.object({
    id: z.string(),
    type: z.enum(['START', 'END', 'TASK', 'DECISION']),
    name: z.string(),
    roleId: z.string().nullable(),
    system: z.string().nullable(),
    processingTime: z.number().min(0).nullable(),
    waitingTime: z.number().min(0).nullable(),
  })).min(2),
  flows: z.array(z.object({
    from: z.string(), to: z.string(),
    label: z.string().nullable(),
    probability: z.number().min(0).max(1).nullable(),
  })),
  uncertainties: z.array(z.string()),                   // wat Claude niet zeker wist
});

// 7.7 Suggesties
export const ProcessSuggestions = z.object({
  suggestions: z.array(z.object({
    title: z.string(),
    stepIds: z.array(z.string()).min(1),
    ruleId: z.string(),
    explanation: z.string(),
    effects: z.object({
      time: Score, cost: Score, quality: Score, flexibility: Score,
    }),
    effort: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    itRequired: z.boolean(),
    risk: z.string(),
    whatToMeasure: z.string(),
  })).max(15),
  answeredQuestions: z.array(z.object({                 // antwoorden op 'question'-regels
    ruleId: z.string(), applies: z.boolean(), stepIds: z.array(z.string()), reason: z.string(),
  })),
  missingValueClasses: z.array(z.object({
    stepId: z.string(), valueClass: z.enum(['CUSTOMER', 'BUSINESS', 'NONE']), reason: z.string(),
  })),
});

// 7.8 Lessen
export const LessonProposals = z.object({
  lessons: z.array(z.object({
    text: z.string().max(400),
    appliesTo: z.enum(['ESTIMATE', 'SUGGEST', 'PLAN', 'ALL']),
    basedOnCaseIds: z.array(z.string()).min(1),
  })).max(5),
});
```

Bij `extractProcess` zet code nullable velden om naar optionele velden, maakt id's uniek en valideert het model. Flows met onbekende stap-id's worden verwijderd met een waarschuwing.

---

## 8. Leren

### 8.1 Correctiefactoren (`src/core/learning/correction.ts`)

Categorie = route. Per afgeronde verbetering met zowel voorspelde als werkelijke waarde:

```
r_I = werkelijkeImpact / voorspeldeImpact          (I uit §6.2, werkelijk = I berekend met werkelijke scores en J)
r_E = werkelijkeUren / voorspeldeUren
```

Ratio's waarvan de noemer 0 is tellen niet mee. Elke ratio wordt eerst begrensd op [0,25 ; 4].

```
n      = aantal geldige ratio's in de categorie
raw    = mediaan van de begrensde ratio's
f      = 1 + (n / (n + k)) × (raw − 1)                  // demping, k = instelling, standaard 5
f      = clamp(f, 0,5 ; 2,0)
actief = n ≥ minCases                                   // instelling, standaard 5; anders f = 1 en „nog te weinig data”
```

Door de mediaan, de begrenzing per ratio en de demping kan één uitschieter de factor maar beperkt verschuiven. De test controleert dat: onder `minCases` is `f = 1`, en bij `minCases` casussen met ratio 1 plus één uitschieter van 100 blijft `f` gelijk aan 1 (de mediaan verandert niet).

### 8.2 Reacties en trefkans (`src/core/learning/hitRate.ts`)

Per regel tellen: `a` = GEACCEPTEERD, `m` = AANGEPAST, `r` = AFGEWEZEN.

```
hitRate = (a + 0,5·m + 1) / (a + m + r + 2)              // Laplace-gladgestreken, 0,5 bij geen data
```

### 8.3 Casusbibliotheek

Een casus ontstaat bij afronden (GEBORGD of AFGEWEZEN). Zoeken met SQLite FTS5 (tabel `cases_fts` over titel, probleemstelling, oplossing, lessen, labels). Is FTS5 niet beschikbaar (controle bij opstarten met `SELECT sqlite_compileoption_used('ENABLE_FTS5')` en een proef-`CREATE VIRTUAL TABLE`), dan valt de app terug op `LIKE` plus labels. De best passende 3 casussen (score: FTS-rang, plus 1 per gedeeld label, plus 1 bij dezelfde route of hetzelfde domein) gaan mee in `estimate`, `plan` en `suggest`.

### 8.4 Draaiboek

Lessen hebben de status VOORGESTELD, ACTIEF of UIT. Alleen ACTIEF gaat mee in prompts, gefilterd op `appliesTo`. Lessen worden nooit automatisch actief.

### 8.5 Promptkwaliteit

- `eval/cases/*.json`: vaste voorbeeldgevallen met invoer en verwachte kenmerken. Voorbeelden: `expectedRoute`, `expectedQuadrant`, `mustMentionStepIds`, `mustNotUseRuleIds`, `maxQuestions`.
- `npm run eval` draait alle gevallen met de nep-AI en de echte rekenlogica. `npm run eval:live` gebruikt de echte API (sleutel uit `ANTHROPIC_API_KEY`).
- Score = aandeel gehaalde kenmerken. Het resultaat wordt opgeslagen in `eval/results/<promptId>.v<N>.<mode>.json`, en in de tabel `prompt_evals` zodra de app het bestand inleest.
- Een nieuwe promptversie wordt pas actief (in `prompts/index.ts`) als de live-score niet lager is dan die van de huidige versie. CLAUDE.md legt die regel vast.

---

## 9. Datamodel (SQLite)

Alle sleutels zijn UUID-tekst; tijden zijn ISO-8601-tekst in UTC; JSON-velden zijn `TEXT` met JSON. Migraties staan genummerd in `src-tauri/migrations/NNNN_name.sql` en worden zowel door Tauri als door de tests (node:sqlite) gebruikt.

| Tabel | Velden |
| --- | --- |
| `settings` | `key` PK, `value` (JSON) — uurtarief, model, drempels, factoren, gewichten, minCases, k, toestemming. **Nooit de API-sleutel.** |
| `processes` | `id`, `name`, `domain`, `created_at`, `updated_at`, `current_version_id` |
| `process_versions` | `id`, `process_id` FK, `version` int, `source_format`, `source_filename`, `model_json`, `confirmed_at` (NULL = concept), `created_at` |
| `analyses` | `id`, `process_version_id` FK, `metrics_json`, `rule_hits_json`, `qualitative` bool, `ai_call_id` FK NULL, `created_at` |
| `suggestions` | `id`, `analysis_id` FK, `title`, `step_ids_json`, `rule_id`, `explanation`, `effects_json`, `effort`, `it_required`, `risk`, `what_to_measure`, `group` (EASY/HARD), `rank`, `rejected_by_code` bool, `reject_reason_code` |
| `suggestion_reactions` | `id`, `suggestion_id` FK, `reaction` (ACCEPTED/MODIFIED/REJECTED), `reason_code`, `reason_text`, `modified_json`, `created_at` |
| `improvements` | `id`, `title`, `description`, `domain`, `status`, `route`, `route_rule`, `quadrant`, `priority`, `process_version_id` FK NULL, `step_ids_json`, `suggestion_id` FK NULL, `category`, `created_at`, `updated_at` |
| `clarifications` | `id`, `improvement_id` FK, `seq` (1..5), `question`, `why_asked`, `answer`, `created_at` |
| `problem_statements` | `improvement_id` PK/FK, `what_goes_wrong`, `how_often`, `cost`, `for_whom`, `edited` bool |
| `assessments` | `id`, `improvement_id` FK, `estimation_json` (ruw van Claude), `effective_json` (na overschrijvingen), `impact_score`, `effort_score`, `certainty`, `annual_benefit`, `correction_json` (ruw/gecorrigeerd/factoren), `ai_call_id` FK, `created_at` |
| `overrides` | `id`, `improvement_id` FK, `field` (pad, bv. `impact.time.score`, `route`), `old_value`, `new_value`, `reason`, `created_at` — leersignaal |
| `action_plans` | `id`, `improvement_id` FK UNIQUE, `template` (route), `metric`, `unit`, `baseline`, `target`, `measure_moment`, `five_whys_json`, `fishbone_json` |
| `action_steps` | `id`, `plan_id` FK, `seq`, `phase`, `what`, `owner`, `due_date`, `deliverable`, `done` bool |
| `outcomes` | `improvement_id` PK/FK, `actual_impact_json`, `actual_annual_benefit`, `actual_hours`, `actual_cost`, `measured_value`, `lessons_text`, `closed_at` |
| `cases` | `id`, `improvement_id` FK UNIQUE, `title`, `problem`, `solution`, `lessons`, `route`, `domain`, `labels_json`, `predicted_json`, `actual_json`, `created_at` |
| `cases_fts` | FTS5-virtuele tabel (`title`, `problem`, `solution`, `lessons`, `labels`), `content='cases'`-achtig bijgehouden door triggers; alleen als FTS5 beschikbaar is |
| `case_labels` | `case_id` FK, `label` — PK (case_id, label) |
| `lessons` | `id`, `text`, `applies_to`, `status`, `based_on_case_ids_json`, `created_at`, `updated_at` |
| `rule_stats` | `rule_id` PK, `accepted`, `modified`, `rejected`, `updated_at` (afgeleid; kan opnieuw berekend worden uit `suggestion_reactions`) |
| `rule_effect_overrides` | `rule_id` PK, `effects_json`, `updated_at` — bijgestelde effecten (leerlus) |
| `ai_calls` | `id`, `kind`, `model`, `prompt_id`, `prompt_version`, `input_tokens`, `output_tokens`, `ok`, `error_code`, `created_at` — **geen inhoud van prompts of antwoorden, geen sleutel** |
| `ai_consent` | `subject_type` (PROCESS/IMPROVEMENT), `subject_id`, `acknowledged_at` — PK (subject_type, subject_id) |
| `prompt_evals` | `id`, `prompt_id`, `prompt_version`, `mode` (FAKE/LIVE), `score`, `details_json`, `created_at` |

Statusovergangen (`src/core/assessment/status.ts`): IDEE → BEOORDEELD → LOOPT → METEN → GEBORGD; elke status → AFGEWEZEN; AFGEWEZEN → IDEE (heropenen). Andere overgangen worden geweigerd.

---

## 10. Techniek

| Onderdeel | Keuze |
| --- | --- |
| App | Tauri 2, macOS-doel. React 18+, TypeScript strict, Vite, Tailwind. |
| Opslag | SQLite via `tauri-plugin-sql` 2.5 (feature `sqlite`, gebundelde SQLite met FTS5), genummerde migraties in `src-tauri/migrations`, ingeladen met `include_str!`. Capability: `sql:default` plus `sql:allow-execute`. |
| Data-toegang | `src/db/` met een `Db`-interface (`execute`, `select`). Implementaties: Tauri (`@tauri-apps/plugin-sql`), Node/tests (`node:sqlite`) en een browser-implementatie (`sql.js`) voor de Playwright-rooktest en ontwikkeling in de browser zonder Tauri. Repositories in `src/db/repos/` gebruiken alleen de interface. |
| Kern | `src/core`: geen import van React, Tauri of `src/ai`/`src/db`. Volledig gedekt met Vitest. |
| Diagram | `@xyflow/react` 12 met automatische opmaak via `elkjs` (ondersteunt geneste knopen, nodig voor banen per rol). Banen zijn groepsknopen; stappen krijgen `parentId` van hun baan. |
| AI | `@anthropic-ai/sdk` + Zod; alles via `src/ai` met de `AiClient`-interface. |
| Netwerk | AI-verzoeken gaan via `@tauri-apps/plugin-http` (fetch aan de Rust-kant, scope beperkt tot `https://api.anthropic.com/*`). De SDK krijgt die `fetch` mee (`new Anthropic({ apiKey, fetch, dangerouslyAllowBrowser: true })`). Buiten Tauri (browser-dev) wordt de gewone `fetch` gebruikt. |
| API-sleutel | Opgeslagen in de macOS-sleutelhanger via eigen Tauri-commando's met de `keyring`-crate 4.x (`set_api_key`, `has_api_key`, `delete_api_key`, `get_api_key`), achter een Rust-trait zodat tests een geheugen-opslag gebruiken. De sleutel staat niet in de database, de repo, logbestanden of `localStorage`. Hij wordt per AI-aanroep opgehaald en niet in React-state bewaard. In browser-dev (zonder Tauri) komt de sleutel uit `sessionStorage` en verdwijnt hij bij sluiten. |
| Bestanden | `fflate` (zip voor `.vsdx`, deflate voor draw.io), `fast-xml-parser` (draw.io, vsdx), `bpmn-moddle` 10 (BPMN, ESM, werkt zonder DOM), `mammoth` (`.docx` → tekst), `read-excel-file` (`.xlsx`; het npm-pakket `xlsx` is verouderd en heeft bekende kwetsbaarheden), `papaparse` (CSV). Mermaid met een eigen parser: er is geen losse flowchart-parser beschikbaar. |
| Export | Markdown door eigen code; PDF met `jspdf` (diagram als PNG via `html-to-image`). Opslaan via `@tauri-apps/plugin-dialog` (`save`) en `@tauri-apps/plugin-fs` (`writeFile`). |
| Tests | Vitest (kern, parsers, repos met node:sqlite, AI-module met nep-`fetch`), Playwright-rooktest tegen de Vite-build met `sql.js` en de nep-AI. |

### 10.1 Foutmeldingen (Nederlands)

| Situatie | Melding |
| --- | --- |
| Geen API-sleutel | „Er is nog geen API-sleutel ingesteld. Ga naar Instellingen.” + knop |
| Geen toestemming | „AI-functies staan uit. Je kunt ze aanzetten in Instellingen.” |
| Geen internet | „Geen verbinding met de Claude API. Controleer je internetverbinding; je werk is bewaard.” |
| 429 / limiet | „Limiet bereikt. Probeer het over een minuut opnieuw.” (met `retry-after` waar bekend) |
| 529 / overbelast | „Claude is tijdelijk overbelast. Probeer het later opnieuw.” |
| 401 | „De API-sleutel wordt niet geaccepteerd.” |
| Schema | „Het antwoord van Claude had niet de verwachte vorm en is niet gebruikt. Probeer het opnieuw.” |
| Weigering | „Claude heeft dit verzoek niet uitgevoerd.” |
| Onleesbaar bestand | parser-specifieke melding, nooit een crash |

---

## 11. Export en back-up

- **Export van een verbetering**: Markdown met probleemstelling, beoordeling (met rekensommen), route, stappenplan, meting en uitkomst. PDF met dezelfde inhoud.
- **Export van een analyse**: Markdown/PDF met kengetallen, regeltreffers, suggesties per groep en een afbeelding van het diagram (PNG via `html-to-image`).
- **JSON-export/import** van een verbetering of casus (voorbereiding op delen met collega's).
- **Back-up**: kopie van het databasebestand naar een gekozen map (`verbeterlus-JJJJMMDD-HHMM.db`). **Terugzetten**: bestand kiezen, schema-versie controleren, huidige database eerst als `.bak` bewaren, daarna vervangen en de app herladen.

---

## 12. Buiten versie 1

Meerdere gebruikers, inloggen, synchronisatie, process mining op logbestanden, simulatie, mobiele app, Windows-build (technisch mogelijk, niet getest), BPMN-export, meerdere pagina's tegelijk uit één `.vsdx`, subprocessen uitklappen, slepen op het overzichtsbord, automatische activering van lessen of promptversies.

`.vsdx` valt op verzoek **wel** binnen versie 1, als parser zonder AI.
