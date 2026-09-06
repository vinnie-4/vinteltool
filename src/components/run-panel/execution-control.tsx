import React from 'react';

const ExecutionControl = () => (
    <div className='execution-control' aria-label='Execution mode'>
        <span className='execution-control__title'>EXECUTION</span>
        <button type='button' className='execution-control__toggle execution-control__toggle--normal' aria-pressed='true'>
            NORMAL
        </button>
    </div>
);

export default ExecutionControl;
