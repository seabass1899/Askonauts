import type { AgeBand, PlaytestContext } from './PlaytestContext';

const AGE_BANDS: AgeBand[] = ['6-7', '8-9', '10-11'];

export function collectParentSetup(): Promise<PlaytestContext> {
  const overlay = document.querySelector<HTMLElement>('#parent-setup-overlay');
  const consent = document.querySelector<HTMLInputElement>('#parent-consent');
  const startButton = document.querySelector<HTMLButtonElement>('#start-playtest');
  const ageButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-age-band]'));

  if (!overlay || !consent || !startButton || !ageButtons.length) {
    throw new Error('Parent setup UI is missing from index.html.');
  }

  const params = new URLSearchParams(window.location.search);
  const source = sanitizeShort(params.get('source') ?? 'direct', 40);
  const testerCodeRaw = params.get('tester');
  const testerCode = testerCodeRaw ? sanitizeShort(testerCodeRaw, 40) : null;

  return new Promise((resolve) => {
    let selectedAgeBand: AgeBand | null = null;

    const updateState = () => {
      startButton.disabled = !(selectedAgeBand && consent.checked);
    };

    for (const button of ageButtons) {
      button.addEventListener('click', () => {
        const value = button.dataset.ageBand as AgeBand | undefined;
        if (!value || !AGE_BANDS.includes(value)) return;

        selectedAgeBand = value;
        for (const item of ageButtons) {
          item.classList.toggle('selected', item === button);
          item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
        }
        updateState();
      });
    }

    consent.addEventListener('change', updateState);

    startButton.addEventListener('click', () => {
      if (!selectedAgeBand || !consent.checked) return;

      overlay.classList.add('hidden');
      window.setTimeout(() => overlay.remove(), 300);
      resolve({ ageBand: selectedAgeBand, source, testerCode });
    }, { once: true });

    updateState();
  });
}

function sanitizeShort(value: string, maxLength: number): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, maxLength) || 'direct';
}
