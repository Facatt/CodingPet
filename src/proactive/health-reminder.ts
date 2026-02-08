import { getConfig } from '../config';

export class HealthReminder {
  private lastActivityTime: number = Date.now();
  private lastReminderTime: number = 0;
  private continuousCodingStart: number = Date.now();
  private timer: NodeJS.Timeout | null = null;
  private callback: (() => void) | null = null;

  start(onReminder: () => void): void {
    this.callback = onReminder;
    this.continuousCodingStart = Date.now();
    this.lastActivityTime = Date.now();
    this.scheduleCheck();
  }

  recordActivity(): void {
    this.lastActivityTime = Date.now();
  }

  private scheduleCheck(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      this.check();
    }, 60000);
  }

  private check(): void {
    const config = getConfig();
    const intervalMs = config.healthReminderInterval * 60 * 1000;
    const now = Date.now();

    if (now - this.lastActivityTime > 5 * 60 * 1000) {
      this.continuousCodingStart = now;
      return;
    }

    const codingDuration = now - this.continuousCodingStart;
    const sinceLastReminder = now - this.lastReminderTime;

    if (codingDuration >= intervalMs && sinceLastReminder >= intervalMs) {
      this.lastReminderTime = now;
      this.continuousCodingStart = now;
      this.callback?.();
    }
  }

  getContinuousCodingMinutes(): number {
    return Math.floor((Date.now() - this.continuousCodingStart) / 60000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
