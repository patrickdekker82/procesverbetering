import { useState, type DragEvent } from 'react';
import { Badge, Button, ErrorText, inputClass, Modal } from '../../components/ui';
import { TEMPLATE_HEADER, type ImportResult, type StepRow } from '../../core/import';
import type { ExtractSource } from '../../ai/input';
import { saveTextFile } from '../../services/saveFile';
import type { ProcessService } from '../../services/processService';
import { useAppState } from '../../state/context';
import { FormInput } from './FormInput';
import { DETECTED_NL } from './labels';

type Tab = 'form' | 'text' | 'file';

const TEMPLATE_CSV = [
  TEMPLATE_HEADER.join(';'),
  's1;Aanvraag ontvangen;taak;Klantenservice;CRM;5;0;1200;;klantwaarde;s2',
  's2;Aanvraag compleet?;beslissing;Klantenservice;;;;;;;s3:ja:0,8;s4:nee:0,2',
  's3;Aanvraag beoordelen;taak;Backoffice;ERP;20;240;960;5%;klantwaarde;',
  's4;Ontbrekende gegevens opvragen;taak;Klantenservice;;10;1440;240;;geen waarde;s2',
].join('\n');

const ACCEPT = '.bpmn,.xml,.drawio,.vsdx,.mmd,.md,.txt,.csv,.xlsx,.docx,.png,.jpg,.jpeg,.gif,.webp,.pdf';

function ConsentDialog({ onAccept, onCancel }: { onAccept: () => void; onCancel: () => void }) {
  return (
    <Modal title="Procesbeschrijving naar Claude sturen?" onClose={onCancel}>
      <p className="text-sm text-slate-700">
        Om dit in te lezen stuurt de app de tekst, het document of de afbeelding naar de Claude API van
        Anthropic. Gaat het om een bedrijfsproces, stem dan af of dit mag. Haal vertrouwelijke namen of
        gegevens er zo nodig eerst uit.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Annuleren
        </Button>
        <Button onClick={onAccept}>Akkoord, versturen</Button>
      </div>
    </Modal>
  );
}

export interface ImportedDraft {
  result: Extract<ImportResult, { ok: true }>;
  fileName: string | null;
}

/** Input step of the process screen: form, text or file; produces a validated draft model. */
export function ImportPanel({
  service,
  draftId,
  onImported,
}: {
  service: ProcessService;
  draftId: string;
  onImported: (draft: ImportedDraft) => void;
}) {
  const { settings } = useAppState();
  const [tab, setTab] = useState<Tab>('file');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<{ format: string; reliability: string } | null>(null);
  const [pending, setPending] = useState<{
    source: ExtractSource;
    hint: string;
    fileName: string | null;
  } | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  function accept(result: ImportResult, fileName: string | null) {
    if (result.ok) {
      setError(null);
      onImported({ result, fileName });
    } else {
      setError(result.error.message + (result.error.detail ? ` (${result.error.detail.slice(0, 160)})` : ''));
    }
  }

  async function runAi(job: { source: ExtractSource; hint: string; fileName: string | null }) {
    if (!settings?.aiConsent) {
      setError(
        'AI-functies staan uit. Zet ze aan in Instellingen, of gebruik een formaat dat zonder AI wordt ingelezen.',
      );
      return;
    }
    if (!(await service.hasConsent(draftId))) {
      setPending(job);
      setConsentOpen(true);
      return;
    }
    setBusy(true);
    const r = await service.extract(draftId, job.source, job.hint);
    setBusy(false);
    if (!r.ok) setError(r.error.messageNl);
    else accept(r.result, job.fileName);
  }

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const outcome = await service.importFile(file.name, bytes);
    setBusy(false);
    const meta = DETECTED_NL[outcome.detection.format];
    setInfo({ format: meta.name, reliability: meta.reliability });
    if (outcome.kind === 'model') accept(outcome.result, file.name);
    else setPending({ source: outcome.source, hint: outcome.hint, fileName: file.name });
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  const tabs: [Tab, string][] = [
    ['file', 'Bestand'],
    ['form', 'Formulier'],
    ['text', 'Tekst'],
  ];

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-1 border-b border-slate-200">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === key ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'file' && (
        <div className="space-y-3">
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-8 text-center hover:border-brand-600"
          >
            <span className="text-sm font-medium text-slate-800">
              Sleep een bestand hierheen of klik om te kiezen
            </span>
            <span className="mt-1 text-xs text-slate-500">
              BPMN, draw.io, Visio (.vsdx), Mermaid, Excel/CSV, Word, PDF of een afbeelding (bijvoorbeeld een
              Visio-export)
            </span>
            <input
              type="file"
              accept={ACCEPT}
              className="sr-only"
              aria-label="Bestand kiezen"
              onChange={(e) => e.target.files?.[0] && void handleFile(e.target.files[0])}
            />
          </label>
          {info && (
            <p className="text-sm text-slate-600">
              <Badge>{info.format}</Badge> {info.reliability}
            </p>
          )}
          {pending && (
            <div className="flex items-center gap-3 rounded-md bg-sky-50 p-3 text-sm">
              <span>Dit bestand wordt door Claude ingelezen.</span>
              <Button busy={busy} onClick={() => runAi(pending)}>
                Laat Claude inlezen
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            onClick={() => saveTextFile('verbeterlus-sjabloon.csv', '﻿' + TEMPLATE_CSV, 'text/csv')}
          >
            Download het Excel/CSV-sjabloon
          </Button>
        </div>
      )}

      {tab === 'form' && (
        <FormInput onSubmit={(rows: StepRow[]) => accept(service.fromRows(rows, 'Nieuw proces'), null)} />
      )}

      {tab === 'text' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Beschrijf het proces in gewone taal of plak een stappenlijst, bijvoorbeeld uit een e-mail of
            werkinstructie. Claude zet het om; daarna controleer je het diagram.
          </p>
          <label htmlFor="process-text" className="sr-only">
            Procesbeschrijving
          </label>
          <textarea
            id="process-text"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={inputClass}
          />
          <Button
            busy={busy}
            disabled={!text.trim()}
            onClick={() =>
              runAi({ source: { kind: 'text', text, origin: 'TEXT' }, hint: '', fileName: null })
            }
          >
            Laat Claude omzetten
          </Button>
        </div>
      )}

      <ErrorText>{error}</ErrorText>
      {consentOpen && (
        <ConsentDialog
          onCancel={() => setConsentOpen(false)}
          onAccept={async () => {
            setConsentOpen(false);
            await service.giveConsent(draftId);
            if (pending) await runAi(pending);
          }}
        />
      )}
    </div>
  );
}
