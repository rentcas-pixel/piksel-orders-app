let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/** Naršyklės reikalauja vartotojo veiksmo prieš garsą — iškviesk po pirmo paspaudimo. */
export function unlockEmailNotificationAudio(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
}

/** Trumpas dvitonis „naujas laiškas“ signalas. */
export function playNewEmailNotificationSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const start = ctx.currentTime;
    const playTone = (frequency: number, at: number, duration: number) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(at);
      oscillator.stop(at + duration);
    };

    playTone(880, start, 0.14);
    playTone(1174.66, start + 0.11, 0.18);
  } catch {
    // Garsas neprivalomas — ignoruojame klaidas.
  }
}
