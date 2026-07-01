const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LOG_LEVELS;

const currentLevel: Level = (process.env.LOG_LEVEL as Level) ?? 'info';

function log(level: Level, message: string, meta?: unknown) {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return;
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
  if (level === 'error') console.error(`${prefix} ${message}${suffix}`);
  else console.log(`${prefix} ${message}${suffix}`);
}

export const logger = {
  debug: (msg: string, meta?: unknown) => log('debug', msg, meta),
  info: (msg: string, meta?: unknown) => log('info', msg, meta),
  warn: (msg: string, meta?: unknown) => log('warn', msg, meta),
  error: (msg: string, meta?: unknown) => log('error', msg, meta),
};
