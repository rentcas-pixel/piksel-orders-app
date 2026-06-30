export type BankImportPhase =
  | 'reading'
  | 'parsing'
  | 'importing'
  | 'allocating'
  | 'done'
  | 'error';

export interface BankImportProgressState {
  active: boolean;
  phase: BankImportPhase;
  label: string;
  current: number;
  total: number;
  fileName: string;
  format: 'csv' | 'xml' | null;
  message: string | null;
}

const INITIAL: BankImportProgressState = {
  active: false,
  phase: 'reading',
  label: '',
  current: 0,
  total: 0,
  fileName: '',
  format: null,
  message: null,
};

let state = INITIAL;
let snapshot = INITIAL;
const listeners = new Set<() => void>();

function emit(next: BankImportProgressState) {
  state = next;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function phaseLabel(phase: BankImportPhase, format: 'csv' | 'xml' | null): string {
  switch (phase) {
    case 'reading':
      return 'Skaitomas failas…';
    case 'parsing':
      return format === 'xml' ? 'Analizuojamas XML…' : 'Analizuojamas CSV…';
    case 'importing':
      return 'Importuojami pavedimai…';
    case 'allocating':
      return 'Sudengiama su sąskaitomis…';
    case 'done':
      return 'Importas baigtas';
    case 'error':
      return 'Importo klaida';
    default:
      return '';
  }
}

export const bankImportProgress = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot(): BankImportProgressState {
    return snapshot;
  },

  start(fileName: string) {
    emit({
      active: true,
      phase: 'reading',
      label: phaseLabel('reading', null),
      current: 0,
      total: 0,
      fileName,
      format: null,
      message: null,
    });
  },

  setFormat(format: 'csv' | 'xml') {
    emit({ ...state, format });
  },

  setPhase(phase: BankImportPhase, current = 0, total = 0) {
    emit({
      ...state,
      phase,
      label: phaseLabel(phase, state.format),
      current,
      total,
      message: null,
    });
  },

  setProgress(current: number, total: number, phase?: BankImportPhase) {
    emit({
      ...state,
      phase: phase ?? state.phase,
      label: phaseLabel(phase ?? state.phase, state.format),
      current,
      total,
    });
  },

  complete(message: string) {
    emit({
      ...state,
      phase: 'done',
      label: phaseLabel('done', state.format),
      message,
      current: state.total > 0 ? state.total : state.current,
    });
  },

  fail(message: string) {
    emit({
      ...state,
      phase: 'error',
      label: phaseLabel('error', state.format),
      message,
    });
  },

  dismiss() {
    emit(INITIAL);
  },
};

export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}
