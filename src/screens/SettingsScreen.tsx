import { useState, type FormEvent, type ReactNode } from 'react';
import { deleteApiKey, setApiKey } from '../ai/apiKey';
import { getAiClient } from '../ai';
import { PageTitle } from '../components/EmptyState';
import { DEFAULT_MODEL } from '../core/settings';
import { useAppState } from '../state/context';

type Feedback = { kind: 'ok' | 'error'; text: string } | null;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-base font-semibold text-slate-800">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Message({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p role="status" className={`text-sm ${feedback.kind === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
      {feedback.text}
    </p>
  );
}

const button =
  'rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton =
  'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const input =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none';

function ApiKeySection() {
  const { keyPresent, refreshKeyStatus } = useAppState();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await setApiKey(value);
      setValue('');
      await refreshKeyStatus();
      setFeedback({ kind: 'ok', text: 'De API-sleutel is veilig opgeslagen in de sleutelhanger.' });
    } catch (error) {
      setFeedback({ kind: 'error', text: `Opslaan mislukt: ${String(error)}` });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteApiKey();
      await refreshKeyStatus();
      setFeedback({ kind: 'ok', text: 'De API-sleutel is verwijderd.' });
    } catch (error) {
      setFeedback({ kind: 'error', text: `Verwijderen mislukt: ${String(error)}` });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setFeedback(null);
    const result = await getAiClient().testConnection();
    setFeedback(
      result.ok
        ? { kind: 'ok', text: `Verbinding gelukt. Model: ${result.displayName} (${result.model}).` }
        : { kind: 'error', text: result.error.messageNl },
    );
    setBusy(false);
  }

  return (
    <Section title="Claude API-sleutel">
      <p className="text-sm text-slate-600">
        Status:{' '}
        <strong data-testid="key-status">
          {keyPresent ? 'sleutel ingesteld' : 'geen sleutel ingesteld'}
        </strong>
        . De sleutel wordt opgeslagen in de sleutelhanger van je computer en nooit getoond of in de database
        bewaard. Maak een sleutel aan in de Claude Console; het verbruik wordt apart afgerekend.
      </p>
      <form onSubmit={save} className="flex gap-2">
        <label className="sr-only" htmlFor="api-key">
          API-sleutel
        </label>
        <input
          id="api-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={keyPresent ? 'Nieuwe sleutel om de huidige te vervangen' : 'sk-ant-…'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={input}
        />
        <button type="submit" className={button} disabled={busy || value.trim() === ''}>
          Opslaan
        </button>
      </form>
      <div className="flex gap-2">
        <button type="button" className={button} onClick={test} disabled={busy}>
          Test verbinding
        </button>
        <button type="button" className={secondaryButton} onClick={remove} disabled={busy || !keyPresent}>
          Sleutel verwijderen
        </button>
      </div>
      <Message feedback={feedback} />
    </Section>
  );
}

function ModelSection() {
  const { settings, updateSettings, keyPresent } = useAppState();
  const [models, setModels] = useState<{ id: string; displayName: string }[]>([]);
  const [draft, setDraft] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  if (!settings) return null;
  const current = draft ?? settings.model;

  async function fetchModels() {
    setFeedback(null);
    const result = await getAiClient().listModels();
    if (result.ok) setModels(result.models);
    else setFeedback({ kind: 'error', text: result.error.messageNl });
  }

  async function save() {
    try {
      await updateSettings({ model: current.trim() });
      setDraft(null);
      setFeedback({ kind: 'ok', text: 'Model opgeslagen.' });
    } catch (error) {
      setFeedback({ kind: 'error', text: String(error instanceof Error ? error.message : error) });
    }
  }

  return (
    <Section title="Model">
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="model">
          Model
        </label>
        <input
          id="model"
          list="model-options"
          value={current}
          onChange={(e) => setDraft(e.target.value)}
          className={input}
        />
        <datalist id="model-options">
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </datalist>
        <button type="button" className={secondaryButton} onClick={fetchModels} disabled={!keyPresent}>
          Modellen ophalen
        </button>
        <button type="button" className={button} onClick={save} disabled={current === settings.model}>
          Opslaan
        </button>
      </div>
      <p className="text-xs text-slate-500">Standaard: {DEFAULT_MODEL}.</p>
      <Message feedback={feedback} />
    </Section>
  );
}

function GeneralSection() {
  const { settings, updateSettings } = useAppState();
  const [rate, setRate] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  if (!settings) return null;
  const rateValue = rate ?? String(settings.hourlyRate);

  async function saveRate() {
    try {
      await updateSettings({ hourlyRate: Number(rateValue.replace(',', '.')) });
      setRate(null);
      setFeedback({ kind: 'ok', text: 'Uurtarief opgeslagen.' });
    } catch (error) {
      setFeedback({ kind: 'error', text: String(error instanceof Error ? error.message : error) });
    }
  }

  async function toggleConsent(value: boolean) {
    await updateSettings({ aiConsent: value });
  }

  return (
    <Section title="Algemeen">
      <div className="flex items-end gap-2">
        <div>
          <label htmlFor="hourly-rate" className="block text-sm font-medium text-slate-700">
            Uurtarief (€)
          </label>
          <input
            id="hourly-rate"
            inputMode="decimal"
            value={rateValue}
            onChange={(e) => setRate(e.target.value)}
            className={`${input} w-32`}
          />
        </div>
        <button type="button" className={button} onClick={saveRate} disabled={rate === null}>
          Opslaan
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Gebruikt voor de jaaropbrengst: frequentie × tijdwinst × uurtarief.
      </p>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={settings.aiConsent}
          onChange={(e) => toggleConsent(e.target.checked)}
          className="mt-1"
        />
        <span>
          <strong>AI-functies aan.</strong> Ideeën en procesbeschrijvingen worden voor analyse naar de Claude
          API (Anthropic) gestuurd. Gebruik je de app voor bedrijfsprocessen, stem dat dan eerst af met je
          werkgever. Vóór de eerste verzending van elk proces of idee vraagt de app nog een keer om
          bevestiging.
        </span>
      </label>
      <Message feedback={feedback} />
    </Section>
  );
}

export function SettingsScreen() {
  const { settings } = useAppState();
  return (
    <>
      <PageTitle>Instellingen</PageTitle>
      {settings ? (
        <div className="max-w-2xl space-y-6">
          <ApiKeySection />
          <ModelSection />
          <GeneralSection />
        </div>
      ) : (
        <p className="text-sm text-slate-500">Instellingen laden…</p>
      )}
    </>
  );
}
