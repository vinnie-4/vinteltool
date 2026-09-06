const FAST_POLL_INTERVAL_MS = 25;
const FAST_WINDOW_DURATION_MS = 350;
const FAST_MIN_RETRY_MS = 25;

let executionMode = 'normal';

export const getExecutionMode = () => executionMode;

export const isFastExecution = () => executionMode === 'fast';

export const setExecutionMode = mode => {
    executionMode = mode === 'fast' ? 'fast' : 'normal';
};

/**
 * FAST is deliberately a timing layer, not a strategy layer.
 *
 * For tick-based volatility indices without the 1s suffix, the normal tick
 * stream is used as-is and every newly received tick can advance the strategy.
 * For 1s indices, FAST cannot create extra market ticks, so it aggressively
 * polls the already-connected tick service for a short window after the bot
 * becomes ready for the next trade. This removes avoidable callback/request
 * latency without changing contract parameters, proposals, stake, martingale,
 * recovery, or strategy blocks.
 */
export const getFastExecutionConfig = () => ({
    pollIntervalMs: FAST_POLL_INTERVAL_MS,
    windowDurationMs: FAST_WINDOW_DURATION_MS,
    minRetryMs: FAST_MIN_RETRY_MS,
});

export const isOneSecondSymbol = symbol => /(^|_)1s$/.test(String(symbol || '').toLowerCase());

export const shouldFastPoll = symbol => isFastExecution() && isOneSecondSymbol(symbol);
