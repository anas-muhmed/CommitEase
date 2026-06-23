type LogLevel = 'INFO' | 'WARN' | 'ERROR';

function emit(level: LogLevel, event: string, meta: Record<string, unknown>): void {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    event,
    ...meta,
  };
  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (event: string, meta: Record<string, unknown> = {}): void => emit('INFO', event, meta),
  warn: (event: string, meta: Record<string, unknown> = {}): void => emit('WARN', event, meta),
  error: (event: string, meta: Record<string, unknown> = {}): void => emit('ERROR', event, meta),
};
