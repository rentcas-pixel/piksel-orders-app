export function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-5.5';
}

export function getOpenAiReasoningEffort(): 'none' | 'low' | 'medium' | 'high' | undefined {
  const raw = process.env.OPENAI_REASONING_EFFORT?.trim().toLowerCase();
  if (!raw) return 'low';
  if (raw === 'none' || raw === 'low' || raw === 'medium' || raw === 'high') {
    return raw;
  }
  return 'low';
}

export function modelSupportsTemperature(model: string): boolean {
  const normalized = model.toLowerCase();
  if (normalized.startsWith('gpt-5') || normalized.startsWith('o1') || normalized.startsWith('o3')) {
    return false;
  }
  return true;
}

export function withOptionalTemperature(
  model: string,
  temperature: number
): { temperature?: number } {
  return modelSupportsTemperature(model) ? { temperature } : {};
}
