import { describe, expect, it } from 'vitest';
import {
  dedupeFewShotExamples,
  normalizeFewShotBody,
  parseFewShotCorpus,
  pickCorpusExamplesFromSamples,
  selectFewShotExamples,
  serializeFewShotCorpus,
  examplesFromThreadMessages,
} from '@/lib/email/email-few-shot';

describe('email-few-shot', () => {
  it('normalizes and truncates body text', () => {
    const long = 'a'.repeat(1000);
    expect(normalizeFewShotBody(long, 100)).toHaveLength(101);
    expect(normalizeFewShotBody('  line1\n\n\n\nline2  ')).toBe('line1\n\nline2');
  });

  it('dedupes by subject and body fingerprint', () => {
    const examples = dedupeFewShotExamples([
      { source: 'thread', subject: 'Re: Sąskaita', body: 'Labas, siunčiu sąskaitą.', priority: 1 },
      { source: 'similar', subject: 'Re: Sąskaita', body: 'Kitas tekstas.', priority: 2 },
      { source: 'corpus', subject: 'Kitas', body: 'Labas, siunčiu sąskaitą.', priority: 3 },
    ]);

    expect(examples).toHaveLength(2);
  });

  it('selects highest-priority examples first', () => {
    const selected = selectFewShotExamples(
      [
        { source: 'corpus', subject: 'C', body: 'corpus body long enough here', priority: 50 },
        { source: 'thread', subject: 'A', body: 'thread body long enough here', priority: 1 },
        { source: 'recipient', subject: 'B', body: 'recipient body long enough', priority: 10 },
      ],
      2
    );

    expect(selected.map((item) => item.source)).toEqual(['thread', 'recipient']);
  });

  it('serializes and parses few-shot corpus', () => {
    const corpus = {
      version: 1 as const,
      examples: [
        {
          subject: 'Test',
          body: 'Labas, testas.',
          date: '2026-07-01T00:00:00.000Z',
          folder: 'Sent',
        },
      ],
    };

    const raw = serializeFewShotCorpus(corpus);
    expect(parseFewShotCorpus(raw)?.examples).toHaveLength(1);
    expect(parseFewShotCorpus('senas abstraktus stiliaus gidas')).toBeNull();
  });

  it('picks diverse corpus examples from samples', () => {
    const picked = pickCorpusExamplesFromSamples([
      {
        subject: 'Re: Vienas',
        date: new Date('2026-07-02'),
        bodyText: 'Pirmas laiškas su pakankamai ilgu tekstu.',
        folder: 'Sent',
      },
      {
        subject: 'Re: Vienas',
        date: new Date('2026-07-01'),
        bodyText: 'Antras laiškas su pakankamai ilgu tekstu.',
        folder: 'Sent',
      },
      {
        subject: 'Kitas',
        date: new Date('2026-06-30'),
        bodyText: 'Trečias laiškas su pakankamai ilgu tekstu.',
        folder: 'Archive',
      },
    ]);

    expect(picked).toHaveLength(2);
    expect(picked[0]?.subject).toBe('Re: Vienas');
  });

  it('extracts self messages from thread as few-shot', () => {
    const examples = examplesFromThreadMessages([
      {
        received_at: '2026-07-01',
        subject: 'Re: Test',
        body: 'Labas, padarysime.',
        is_self: true,
      },
      {
        received_at: '2026-06-30',
        subject: 'Re: Test',
        body: 'Klausimas?',
        is_self: false,
      },
    ]);

    expect(examples).toHaveLength(1);
    expect(examples[0]?.source).toBe('thread');
  });
});
