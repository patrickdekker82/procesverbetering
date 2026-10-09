import { Button, Modal } from '../../components/ui';

export function ConsentDialog({ onAccept, onCancel }: { onAccept: () => void; onCancel: () => void }) {
  return (
    <Modal title="Gegevens naar Claude sturen?" onClose={onCancel}>
      <div className="space-y-3 text-sm text-slate-700">
        <p>
          Voor deze stap stuurt de app de volgende gegevens van dit idee naar de Claude API van Anthropic:
        </p>
        <ul className="list-disc pl-5">
          <li>titel, beschrijving en domein;</li>
          <li>de vragen en jouw antwoorden;</li>
          <li>de probleemstelling en (voor het stappenplan) de beoordeling.</li>
        </ul>
        <p>
          Je API-sleutel en andere ideeën worden niet meegestuurd. Gaat het om een bedrijfsproces, stem dan af
          of dit mag. Je bevestigt dit één keer per idee.
        </p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Annuleren
        </Button>
        <Button onClick={onAccept}>Akkoord, versturen</Button>
      </div>
    </Modal>
  );
}
