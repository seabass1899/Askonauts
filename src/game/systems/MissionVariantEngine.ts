export class MissionVariantEngine {
  static pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('MissionVariantEngine.pick requires at least one item.');
    return items[Math.floor(Math.random() * items.length)];
  }

  static chance(probability: number): boolean {
    const p = Math.max(0, Math.min(1, probability));
    return Math.random() < p;
  }

  static shuffled<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  static sample<T>(items: readonly T[], minCount: number, maxCount = minCount): T[] {
    if (items.length === 0) return [];
    const min = Math.max(1, Math.min(items.length, Math.floor(minCount)));
    const max = Math.max(min, Math.min(items.length, Math.floor(maxCount)));
    const count = min + Math.floor(Math.random() * (max - min + 1));
    return this.shuffled(items).slice(0, count);
  }

  static signature(parts: readonly (string | number | boolean | undefined)[]): string {
    return parts.filter((part) => part !== undefined).map(String).join('-').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  }
}
