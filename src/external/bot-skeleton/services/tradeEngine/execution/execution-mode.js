let executionMode = 'normal';

export const getExecutionMode = () => executionMode;

export const isFastExecution = () => executionMode === 'fast';

export const setExecutionMode = mode => {
    executionMode = mode === 'fast' ? 'fast' : 'normal';
};

/**
 * FAST is an event-driven low-latency path. It never fabricates ticks and it
 * never polls the API. The real tick stream remains the source of truth.
 *
 * On ordinary tick indices, every real incoming tick can advance the bot
 * immediately. On 1-second indices, the bot still executes only when the
 * real 1-second tick arrives, but avoids the extra Redux/state notification
 * hop before resuming the Blockly interpreter.
 */
export const getFastExecutionConfig = () => ({
    eventDriven: true,
    pollIntervalMs: 0,
    windowDurationMs: 0,
});

export const isOneSecondSymbol = symbol => /(^|_)1s$/.test(String(symbol || '').toLowerCase());

export const shouldFastPoll = () => false;
