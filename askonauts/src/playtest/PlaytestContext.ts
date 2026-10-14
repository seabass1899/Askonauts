export type AgeBand = '6-7' | '8-9' | '10-11';

export type PlaytestContext = {
  ageBand: AgeBand;
  source: string;
  testerCode: string | null;
};

let context: PlaytestContext | null = null;

export function setPlaytestContext(value: PlaytestContext): void {
  context = value;
}

export function getPlaytestContext(): PlaytestContext {
  if (!context) {
    throw new Error('Playtest context has not been initialized.');
  }
  return context;
}
