import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';

type ExecutionMode = 'normal' | 'fast';

const ExecutionControl = observer(() => {
    const { run_panel } = useStore();
    const [mode, setMode] = React.useState<ExecutionMode>('normal');
    const is_running = run_panel.is_stop_button_visible;

    const toggleMode = () => {
        // NORMAL deliberately uses the existing bot execution path.
        // Never allow the execution mode to change during an active run.
        if (is_running) return;
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
                disabled={is_running}
                onClick={toggleMode}
            >
                <span className='execution-control__switch-knob' />
            </button>
        </div>
    );
});

export default ExecutionControl;
