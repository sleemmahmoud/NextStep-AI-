// ============================================================
// Logger بسيط: بيطبع كل حاجة كـJSON منظم في GitHub Actions logs (سهل تتبعها)
// وبيسجلها كمان في مصفوفة داخلية عشان تتحط في تقرير التشغيل النهائي.
// ============================================================

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  ts: number;
}

export class Logger {
  private entries: LogEntry[] = [];

  private write(level: LogLevel, message: string, data?: unknown) {
    const entry: LogEntry = { level, message, data, ts: Date.now() };
    this.entries.push(entry);
    const line = JSON.stringify({ level, message, data });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  info(message: string, data?: unknown) {
    this.write("info", message, data);
  }
  warn(message: string, data?: unknown) {
    this.write("warn", message, data);
  }
  error(message: string, data?: unknown) {
    this.write("error", message, data);
  }

  getEntries(): LogEntry[] {
    return this.entries;
  }
}
