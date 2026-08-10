type ClockTask = {
  at: number;
  resolve: () => void;
};

class GameClock {
  private virtualTime = 0;
  private speed = 1;
  private tasks: ClockTask[] = [];
  private lastRealTime = performance.now();
  private frame = 0;

  constructor() {
    const tick = (now: number) => {
      const delta = Math.min(100, Math.max(0, now - this.lastRealTime));
      this.lastRealTime = now;
      this.advance(delta * this.speed);
      this.frame = requestAnimationFrame(tick);
    };

    this.frame = requestAnimationFrame(tick);
  }

  wait(milliseconds: number): Promise<void> {
    if (milliseconds <= 0) return Promise.resolve();

    return new Promise((resolve) => {
      this.tasks.push({ at: this.virtualTime + milliseconds, resolve });
      this.tasks.sort((a, b) => a.at - b.at);
    });
  }

  advance(milliseconds: number): void {
    this.virtualTime += Math.max(0, milliseconds);
    const ready = this.tasks.filter((task) => task.at <= this.virtualTime);
    this.tasks = this.tasks.filter((task) => task.at > this.virtualTime);
    ready.forEach((task) => task.resolve());
    window.dispatchEvent(new CustomEvent("cookie:advance", { detail: milliseconds }));
  }

  setSpeed(multiplier: number): void {
    this.speed = Math.max(0.25, Math.min(100, multiplier));
  }

  resetSpeed(): void {
    this.speed = 1;
  }
}

export const gameClock = new GameClock();
