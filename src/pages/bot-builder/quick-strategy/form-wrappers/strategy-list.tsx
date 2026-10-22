import React from 'react';
import Text from '@/components/shared_ui/text';
import { Link } from '@deriv-com/quill-ui';
import { localize } from '@deriv-com/translations';
import { STRATEGY_TRADE_ASSOCIATIONS, TStrategyTradeAssociations } from './trade-constants';

type TStrategyListProps = {
    search_value?: string;
    is_searching?: boolean;
    onSelectStrategy: (strategy: string, trade_type: string) => void;
};

type TStrategyBlockProps = {
    title: string;
    items: TStrategyTradeAssociations;
    onSelectStrategy: (strategy: string, trade_type: string) => void;
};

const StrategyBlock = ({ title, items, onSelectStrategy }: TStrategyBlockProps) => {
    if (!items.length) return null;

    return (
        <section className='strategy-template-picker__strategy' aria-label={title}>
            <div className='strategy-template-picker__title'>
                <Text size='xs' weight='bold'>{title}</Text>
            </div>
            {items.map(item => (
                <div className='strategy-template-picker__links' key={item.name}>
                    <Link hasChevron size='sm' onClick={() => onSelectStrategy(item.name, title)}>
                        {item.display_name}
                    </Link>
                </div>
            ))}
        </section>
    );
};

const StrategyList = ({ search_value = '', is_searching = false, onSelectStrategy }: TStrategyListProps) => {
    const strategies = is_searching && search_value
        ? STRATEGY_TRADE_ASSOCIATIONS.filter(item =>
            item.display_name.toLowerCase().includes(search_value.toLowerCase()) ||
            item.parent.some(parent => parent.toLowerCase().includes(search_value.toLowerCase()))
        )
        : STRATEGY_TRADE_ASSOCIATIONS;

    const options = strategies.filter(item => item.parent.includes(localize('Options')));
    const accumulators = strategies.filter(item => item.parent.includes(localize('Accumulators')));

    return (
        <div className='strategy-template-picker__strategies'>
            <StrategyBlock title={localize('Options')} items={options} onSelectStrategy={onSelectStrategy} />
            <StrategyBlock title={localize('Accumulators')} items={accumulators} onSelectStrategy={onSelectStrategy} />
            {!options.length && !accumulators.length && (
                <div className='no-results'><Text size='xs'>{localize('No results found')}</Text></div>
            )}
        </div>
    );
};

export default StrategyList;
