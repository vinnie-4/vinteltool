import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';

type ExecutionMode = 'normal' | 'fast';

const ExecutionControl = observer(() => {
    const { run_panel } = useStore();
    const [mode, setMode] = React.useState<ExecutionMode>('normal');
    const is_running = run_panel.is_stop_button_visible;

    const toggleMode = () => {
        if (is_running) return;
        setMode(current => (current === 'normal' ? 'fast' : 'normal'));
    };

    // Execution selection is only needed while the bot is stopped.
    // The running state is represented by the existing bot-status area.
    if (is_running) return null;

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
});

export default ExecutionControl;
