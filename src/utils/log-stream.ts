import { EventEmitter } from 'node:events';

type LogEntry = { type: 'info' | 'error' | 'warn' | 'success'; message: string; timestamp: string };

class LogStream extends EventEmitter {
  private logs: LogEntry[] = [];
  private maxLogs = 500;

  write(type: LogEntry['type'], message: string) {
    const entry: LogEntry = { type, message, timestamp: new Date().toISOString() };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) this.logs.shift();
    this.emit('log', entry);
  }

  getLogs() {
    return this.logs;
  }

  clear() {
    this.logs = [];
  }

  info(msg: string) { this.write('info', msg); }
  error(msg: string) { this.write('error', msg); }
  warn(msg: string) { this.write('warn', msg); }
  success(msg: string) { this.write('success', msg); }
}

export const logStream = new LogStream();

// patch console.log to also stream
const originalLog = console.log;
const originalError = console.error;

console.log = (...args: unknown[]) => {
  originalLog(...args);
  logStream.info(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
};

console.error = (...args: unknown[]) => {
  originalError(...args);
  logStream.error(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
};
