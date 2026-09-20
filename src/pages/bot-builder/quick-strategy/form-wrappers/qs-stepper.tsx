// Removed unused React import - React 17+ JSX transform doesn't require it
import { localize } from '@deriv-com/translations';
import { LinearProgressBar } from '@deriv-com/ui';
import { QsSteps } from './trade-constants';

type TQSStepper = {
    current_step: QsSteps;
    is_mobile?: boolean;
};

const QSStepper = ({ current_step, is_mobile = false }: TQSStepper) => {
    const percentage = current_step === QsSteps.StrategyCompleted ? 100 : 50;
    return is_mobile ? (
        <div className='qs-stepper__mobile'>
            <LinearProgressBar percentage={percentage} label='' danger_limit={101} is_loading={false} warning_limit={0} />
            <div className='qs-stepper__mobile-label'>
                {current_step === QsSteps.StrategySelect
                    ? localize('1. Select strategy')
                    : localize('2. Configure parameters')}
            </div>
        </div>
    ) : (
        <div className='qs-stepper'>
            <div className={`qs-stepper__item ${current_step === QsSteps.StrategySelect ? 'active' : 'completed'}`}>
                <span className='qs-stepper__number'>1</span>
                <span>{localize('Select strategy')}</span>
            </div>
            <div className={`qs-stepper__item ${current_step !== QsSteps.StrategySelect ? 'active' : ''}`}>
                <span className='qs-stepper__number'>2</span>
                <span>{localize('Configure parameters')}</span>
            </div>
        </div>
    );
};

export default QSStepper;
