let paused = false;
let pauseWaiters = [];

export const isExecutionPaused = () => paused;

export const pauseExecution = () => {
    paused = true;
};

export const resumeExecution = () => {
    if (!paused) return;

    paused = false;
    const waiters = pauseWaiters;
    pauseWaiters = [];
    waiters.forEach(resolve => resolve());
};

/**
 * Gate only the next execution step. This does not stop/cancel an already
 * submitted contract, disconnect the socket, reset strategy state, or start
 * another execution loop.
 */
export const waitForExecutionResume = () => {
    if (!paused) return Promise.resolve();

    return new Promise(resolve => {
        pauseWaiters.push(resolve);
    });
};
