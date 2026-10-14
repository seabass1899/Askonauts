import type { PlayerProgress } from '../progress/PlayerProgressStore';

export type QuestionNodeState = 'completed' | 'available' | 'discovered' | 'mystery';
export type QuestionNodeKind = 'world' | 'discovery' | 'future';

export type QuestionTreeNode = {
  id: string;
  title: string;
  question: string;
  parentId: string | null;
  worldId?: string;
  kind: QuestionNodeKind;
  state: QuestionNodeState;
};

function hasDiscovery(progress: PlayerProgress, worldId: string, discoveryId: string): boolean {
  return progress.worldProgress[worldId]?.discoveries?.includes(discoveryId) ?? false;
}

export function buildQuestionTree(progress: PlayerProgress): QuestionTreeNode[] {
  const shadow = progress.worldProgress['shadow-chase'];
  const shadowCompleted = Boolean(shadow?.completed);
  const shadowStarted = shadowCompleted || Boolean(shadow?.discoveries?.length);
  const sizeAnswered = hasDiscovery(progress, 'shadow-chase', 'large_shadow')
    && hasDiscovery(progress, 'shadow-chase', 'small_shadow');
  const reflection = progress.worldProgress['reflection-hunt'];
  const reflectionCompleted = Boolean(reflection?.completed);
  const reflectionDiscovered = shadowCompleted || progress.unlockedWorldIds.includes('reflection-hunt') || reflectionCompleted;
  const spoon = progress.worldProgress['upside-down-spoon'];
  const spoonCompleted = Boolean(spoon?.completed);
  const spoonAvailable = reflectionCompleted || progress.unlockedWorldIds.includes('upside-down-spoon') || spoonCompleted;
  const funhouse = progress.worldProgress['funhouse-mirrors'];
  const funhouseCompleted = Boolean(funhouse?.completed);
  const funhouseAvailable = spoonCompleted || progress.unlockedWorldIds.includes('funhouse-mirrors') || funhouseCompleted;

  return [
    {
      id: 'shadow-chase',
      title: 'SHADOW CHASE',
      question: 'Why do shadows follow us?',
      parentId: null,
      worldId: 'shadow-chase',
      kind: 'world',
      state: shadowCompleted ? 'completed' : 'available'
    },
    {
      id: 'shadow-size',
      title: 'SHADOW SIZE',
      question: 'Why does a shadow change size?',
      parentId: 'shadow-chase',
      kind: 'discovery',
      state: sizeAnswered ? 'completed' : shadowStarted ? 'discovered' : 'mystery'
    },
    {
      id: 'reflection-hunt',
      title: 'REFLECTION HUNT',
      question: 'Why can we see ourselves in some things?',
      parentId: 'shadow-chase',
      worldId: 'reflection-hunt',
      kind: 'world',
      state: reflectionCompleted ? 'completed' : reflectionDiscovered ? 'available' : 'mystery'
    },
    {
      id: 'two-shadows',
      title: 'DOUBLE SHADOW?',
      question: 'Can one object make two shadows?',
      parentId: 'shadow-size',
      kind: 'future',
      state: sizeAnswered && shadowCompleted ? 'discovered' : 'mystery'
    },
    {
      id: 'spoon-reflection',
      title: 'UPSIDE-DOWN SPOON',
      question: 'Why does a spoon flip your reflection?',
      parentId: 'reflection-hunt',
      worldId: 'upside-down-spoon',
      kind: 'world',
      state: spoonCompleted ? 'completed' : spoonAvailable ? 'available' : 'mystery'
    },
    {
      id: 'funhouse-mirrors',
      title: 'FUNHOUSE MIRRORS',
      question: 'Why do funhouse mirrors stretch and squash us?',
      parentId: 'spoon-reflection',
      worldId: 'funhouse-mirrors',
      kind: 'world',
      state: funhouseCompleted ? 'completed' : funhouseAvailable ? 'available' : 'mystery'
    }
  ];
}

export function countRevealedQuestions(nodes: readonly QuestionTreeNode[]): number {
  return nodes.filter((node) => node.state !== 'mystery').length;
}
