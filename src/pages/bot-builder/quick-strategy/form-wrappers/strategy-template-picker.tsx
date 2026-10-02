import React from 'react';
import { useFormikContext } from 'formik';
import { observer } from 'mobx-react-lite';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { SearchField } from '@deriv-com/quill-ui-next';
import { localize } from '@deriv-com/translations';
import { TFormData } from '../types';
import StrategyList from './strategy-list';
import { QsSteps } from './trade-constants';
import './strategy-template-picker.scss';

type TStrategyTemplatePicker = {
    setCurrentStep: (current_step: QsSteps) => void;
    setSelectedTradeType: (selected_trade_type: string) => void;
};

const StrategyTemplatePicker = observer(({ setCurrentStep, setSelectedTradeType }: TStrategyTemplatePicker) => {
    const { dashboard, quick_strategy } = useStore();
    const { setActiveTabTutorial, setActiveTab, setFAQSearchValue, filterTuotrialTab } = dashboard;
    const { setFormVisibility, setSelectedStrategy } = quick_strategy;
    const { setFieldValue } = useFormikContext<TFormData>();

    const onSelectStrategy = (strategy: string, trade_type: string) => {
        setSelectedStrategy(strategy);
        setSelectedTradeType(trade_type);

        // Set additional data with initial values when strategy changes
        quick_strategy.setAdditionalData({
            max_payout: null,
            max_ticks: null,
            max_stake: null,
            min_stake: null,
        });

        // Update the Formik form value directly
        setFieldValue('stake', '1', true);

        setCurrentStep(QsSteps.StrategyVerified);
    };

    return (
        <div className='strategy-template-picker'>
            <StrategyList
                search_value={search_value}
                is_searching={is_searching}
                onSelectStrategy={onSelectStrategy}
            />
        </div>
    );
});

export default StrategyTemplatePicker;
