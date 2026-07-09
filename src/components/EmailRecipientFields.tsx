import { EmailAddressInput } from '@/components/EmailAddressInput';

interface EmailRecipientFieldsProps {
  to: string;
  cc: string;
  bcc: string;
  onToChange: (value: string) => void;
  onCcChange: (value: string) => void;
  onBccChange: (value: string) => void;
  disabled?: boolean;
  showCcBcc?: boolean;
  onToggleCcBcc?: () => void;
  mailboxAddress?: string;
}

export function EmailRecipientFields({
  to,
  cc,
  bcc,
  onToChange,
  onCcChange,
  onBccChange,
  disabled,
  showCcBcc = true,
  onToggleCcBcc,
  mailboxAddress,
}: EmailRecipientFieldsProps) {
  return (
    <div className="space-y-2">
      <EmailAddressInput
        label="Kam"
        value={to}
        onChange={onToChange}
        disabled={disabled}
        mailboxAddress={mailboxAddress}
        placeholder="vardas@example.com, kitas@example.com"
      />

      {showCcBcc ? (
        <>
          <EmailAddressInput
            label="Cc"
            value={cc}
            onChange={onCcChange}
            disabled={disabled}
            mailboxAddress={mailboxAddress}
            placeholder="pasirinktini kopijos gavėjai"
          />
          <EmailAddressInput
            label="Bcc"
            value={bcc}
            onChange={onBccChange}
            disabled={disabled}
            mailboxAddress={mailboxAddress}
            placeholder="paslėpta kopija"
          />
        </>
      ) : (
        onToggleCcBcc && (
          <button
            type="button"
            onClick={onToggleCcBcc}
            className="text-xs font-medium text-violet-700 hover:text-violet-900 dark:text-violet-300"
          >
            Rodyti Cc / Bcc
          </button>
        )
      )}
    </div>
  );
}
