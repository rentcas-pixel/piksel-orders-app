'use client';

import { useEffect, useRef, useState } from 'react';
import { PaperAirplaneIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { EmailAgentChatMessage } from '@/lib/email/email-agent-chat';
import type { ProcessedEmail } from '@/lib/email/types';

interface EmailAgentChatProps {
  emailId?: string;
  emailSubject?: string | null;
  threadEmails?: ProcessedEmail[];
  currentDraft?: string;
  mailboxAddress?: string;
  disabled?: boolean;
  variant?: 'inline' | 'sidebar' | 'embedded';
  onDraftUpdate?: (draft: string, email?: ProcessedEmail) => void;
  onClose?: () => void;
}

const STARTER_PROMPTS = [
  'Padaryk trumpiau ir mandagiau',
  'Pridėk, kad peržiūrėjau ataskaitą',
  'Ar verta apskritai atsakyti?',
  'Perrašyk formaliau angliškai',
];

export function EmailAgentChat({
  emailId,
  emailSubject,
  threadEmails = [],
  currentDraft = '',
  mailboxAddress,
  disabled,
  variant = 'inline',
  onDraftUpdate,
  onClose,
}: EmailAgentChatProps) {
  const [messages, setMessages] = useState<EmailAgentChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isSidebar = variant === 'sidebar';
  const isEmbedded = variant === 'embedded';
  const canChat = Boolean(emailId);

  useEffect(() => {
    setMessages([]);
    setInput('');
    setError(null);
  }, [emailId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading || disabled || !emailId) return;

    const userMessage: EmailAgentChatMessage = { role: 'user', content: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/email/emails/${emailId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          currentDraft,
          messages,
          threadEmails: threadEmails.length ? threadEmails : undefined,
          mailboxAddress,
        }),
      });

      const payload = (await response.json()) as {
        data?: {
          assistant_message: string;
          updated_draft: string | null;
          email?: ProcessedEmail;
        };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Nepavyko gauti atsakymo.');
      }

      if (payload.data?.assistant_message) {
        setMessages([
          ...nextMessages,
          { role: 'assistant', content: payload.data.assistant_message },
        ]);
      }

      if (payload.data?.updated_draft && onDraftUpdate) {
        onDraftUpdate(payload.data.updated_draft, payload.data.email);
      }
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : 'Nepavyko gauti atsakymo.');
      setMessages(messages);
      setInput(trimmed);
    } finally {
      setLoading(false);
    }
  };

  const shellClass = isEmbedded
    ? 'flex h-full min-h-0 flex-col'
    : isSidebar
      ? 'flex h-full min-h-[420px] flex-col rounded-xl border border-violet-200 dark:border-violet-900/50 bg-white dark:bg-gray-800 shadow-sm'
      : 'rounded-lg border border-violet-200 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/20 p-4';

  const messagesClass = isEmbedded || isSidebar
    ? 'flex-1 min-h-0 overflow-y-auto space-y-2 px-1 py-2'
    : 'max-h-48 overflow-y-auto space-y-2 mb-3 pr-1';

  return (
    <div className={shellClass}>
      <div
        className={`flex items-start justify-between gap-3 ${
          isEmbedded
            ? 'mb-2'
            : `border-b border-violet-100 dark:border-violet-900/40 ${isSidebar ? 'px-4 py-3' : 'mb-3'}`
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 shrink-0 text-violet-600 dark:text-violet-300" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              {isEmbedded || isSidebar ? 'Agentas' : 'Pasiderėti su agentu prieš siunčiant'}
            </h3>
          </div>
          {(isSidebar || isEmbedded) && emailSubject && (
            <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{emailSubject}</p>
          )}
          {!isSidebar && !isEmbedded && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Agentas mato šį laišką, giją ir juodraštį. Jūsų rašymo stilių — jei spausdėte „Išmokti
              stilių“. Visos pašto dėžutės istorijos nemato.
            </p>
          )}
        </div>
        {isSidebar && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Suskleisti agentą"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {!canChat ? (
        isEmbedded ? null : (
        <div className={`flex flex-1 items-center justify-center p-6 text-center ${isSidebar ? '' : ''}`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Pasirinkite laišką iš sąrašo — čia galėsite pasiderėti su agentu prieš siunčiant.
          </p>
        </div>
        )
      ) : (
        <>
          {messages.length === 0 && (
            <div className={`flex flex-wrap gap-2 ${isSidebar || isEmbedded ? 'pb-2' : 'mb-3'}`}>
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={disabled || loading}
                  onClick={() => void sendMessage(prompt)}
                  className="rounded-full border border-violet-200 dark:border-violet-800 px-3 py-1 text-xs text-violet-700 dark:text-violet-200 hover:bg-violet-100/70 dark:hover:bg-violet-900/30 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div className={messagesClass}>
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  message.role === 'user'
                    ? 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 ml-6'
                    : 'bg-violet-50 dark:bg-violet-950/40 border border-violet-200/70 dark:border-violet-800 mr-2'
                }`}
              >
                {message.content}
              </div>
            ))}
            {loading && <p className="text-xs text-gray-400 animate-pulse">Agentas galvoja…</p>}
            <div ref={bottomRef} />
          </div>

          <div className={`${isSidebar || isEmbedded ? 'mt-auto border-t border-violet-100 dark:border-violet-900/40 pt-3' : ''}`}>
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(input);
                  }
                }}
                disabled={disabled || loading}
                rows={isSidebar || isEmbedded ? 2 : 1}
                placeholder="Pvz. padaryk trumpiau / parašyk angliškai..."
                className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void sendMessage(input)}
                disabled={disabled || loading || !input.trim()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                aria-label="Siųsti žinutę agentui"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
            </div>
            {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
