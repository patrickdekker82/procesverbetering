import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTitle } from '../components/EmptyState';
import { Button, ErrorText, Field, inputClass, Select } from '../components/ui';
import { useImprovementService } from './improvements/useImprovementService';

const DOMAINS: [string, string][] = [
  ['KANTOOR', 'Kantoor en administratie'],
  ['KLANT', 'Klantprocessen en service'],
];

export function NewImprovementScreen() {
  const service = useImprovementService();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('KANTOOR');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!service) return;
    setBusy(true);
    const result = await service.create({ title, description, domain });
    setBusy(false);
    if (result.ok) navigate(`/verbeteringen/${result.value}`);
    else setError(result.error.messageNl);
  }

  return (
    <>
      <PageTitle>Nieuw idee</PageTitle>
      <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <Field label="Titel" htmlFor="title" hint="Kort: wat wil je verbeteren of wat gaat er mis?">
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </Field>
        <Field
          label="Beschrijving"
          htmlFor="description"
          hint="Beschrijf het probleem zo concreet mogelijk. Een oplossing mag ook; de app vraagt dan door naar het probleem."
        >
          <textarea
            id="description"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Domein" htmlFor="domain">
          <Select id="domain" value={domain} options={DOMAINS} onChange={setDomain} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <Button type="submit" busy={busy} disabled={!service}>
            Opslaan en verder
          </Button>
          <Button variant="secondary" onClick={() => navigate('/verbeteringen')}>
            Annuleren
          </Button>
        </div>
      </form>
    </>
  );
}
