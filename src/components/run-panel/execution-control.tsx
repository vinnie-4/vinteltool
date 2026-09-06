import React from 'react';

type ExecutionMode = 'normal' | 'fast';

const ExecutionControl = () => {
    const [mode, setMode] = React.useState<ExecutionMode>('normal');

    const toggleMode = () => {
        setMode(current => (current === 'normal' ? 'fast' : 'normal'));
    };

    return (
        <div className='execution-control' aria-label='Execution mode'>
            <div className='execution-control__labels'>
                <span className='execution-control__title'>Execution</span>
                <span className='execution-control__mode'>{mode === 'normal' ? 'NORMAL' : 'FAST'}</span>
            </div>
            <button
                type='button'
                className={`execution-control__switch execution-control__switch--${mode}`}
                aria-label={`Switch execution mode. Current mode: ${mode}`}
                aria-pressed={mode === 'fast'}
                onClick={toggleMode}
            >
                <span className='execution-control__switch-knob' />
            </button>
        </div>
    );
};

export default ExecutionControl;
