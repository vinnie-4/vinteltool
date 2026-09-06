const FAST_WINDOWS_MS = [1000, 1200, 1400, 1500];

let executionMode = 'normal';

export const getExecutionMode = () => executionMode;

export const isFastExecution = () => executionMode === 'fast';

export const setExecutionMode = mode => {
    executionMode = mode === 'fast' ? 'fast' : 'normal';
};

export const getFastExecutionWindows = () => [...FAST_WINDOWS_MS];
