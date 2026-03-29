// ── Simple tweening animation system ────────────────────────

export interface Tween {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  currentX: number;
  currentY: number;
  startTime: number;
  duration: number;
  easing: (t: number) => number;
  onComplete?: () => void;
  tag?: string; // optional label for querying
  startScale?: number;
  endScale?: number;
  currentScale?: number;
  startAlpha?: number;
  endAlpha?: number;
  currentAlpha?: number;
}

let nextId = 0;

export class AnimationSystem {
  private tweens: Map<number, Tween> = new Map();

  create(opts: {
    startX: number; startY: number;
    endX: number; endY: number;
    duration: number;
    easing?: (t: number) => number;
    onComplete?: () => void;
    tag?: string;
    startScale?: number; endScale?: number;
    startAlpha?: number; endAlpha?: number;
  }): Tween {
    const tween: Tween = {
      id: nextId++,
      startX: opts.startX,
      startY: opts.startY,
      endX: opts.endX,
      endY: opts.endY,
      currentX: opts.startX,
      currentY: opts.startY,
      startTime: performance.now(),
      duration: opts.duration,
      easing: opts.easing ?? easeOutCubic,
      onComplete: opts.onComplete,
      tag: opts.tag,
      startScale: opts.startScale ?? 1,
      endScale: opts.endScale ?? 1,
      currentScale: opts.startScale ?? 1,
      startAlpha: opts.startAlpha ?? 1,
      endAlpha: opts.endAlpha ?? 1,
      currentAlpha: opts.startAlpha ?? 1,
    };
    this.tweens.set(tween.id, tween);
    return tween;
  }

  update(now: number): void {
    for (const [id, tw] of this.tweens) {
      const elapsed = now - tw.startTime;
      const rawT = Math.min(elapsed / tw.duration, 1);
      const t = tw.easing(rawT);

      tw.currentX = tw.startX + (tw.endX - tw.startX) * t;
      tw.currentY = tw.startY + (tw.endY - tw.startY) * t;
      tw.currentScale = (tw.startScale ?? 1) + ((tw.endScale ?? 1) - (tw.startScale ?? 1)) * t;
      tw.currentAlpha = (tw.startAlpha ?? 1) + ((tw.endAlpha ?? 1) - (tw.startAlpha ?? 1)) * t;

      if (rawT >= 1) {
        tw.onComplete?.();
        this.tweens.delete(id);
      }
    }
  }

  isAnimating(): boolean {
    return this.tweens.size > 0;
  }

  getByTag(tag: string): Tween | undefined {
    for (const tw of this.tweens.values()) {
      if (tw.tag === tag) return tw;
    }
    return undefined;
  }

  clear(): void {
    this.tweens.clear();
  }

  get count(): number {
    return this.tweens.size;
  }
}

// ── Easing functions ────────────────────────────────────────

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

export function linear(t: number): number {
  return t;
}
