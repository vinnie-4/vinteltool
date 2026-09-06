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
 * The small execution-yield reduction is intentionally conservative: it lets
 * the interpreter resume a fraction sooner without changing the market tick,
 * contract parameters, strategy, stake, martingale, or recovery behaviour.
 */
export const getFastExecutionConfig = () => ({
    eventDriven: true,
    pollIntervalMs: 0,
    windowDurationMs: 0,
    executionYieldMs: 0,
});

export const isOneSecondSymbol = symbol => /(^|_)1s$/.test(String(symbol || '').toLowerCase());

export const shouldFastPoll = () => false;
