// Removed unused React import - React 17+ JSX transform doesn't require it
import Text from '@/components/shared_ui/text';
import { Link } from '@deriv-com/quill-ui';
import { localize } from '@deriv-com/translations';
import { STRATEGY_TRADE_ASSOCIATIONS, TStrategyTradeAssociations } from './trade-constants';

type TStrategyListProps = {
    search_value?: string;
    is_searching?: boolean;
    onSelectStrategy: (strategy: string, trade_type: string) => void;
};
type TStrategyBlock = {
    title: string;
    items: TStrategyTradeAssociations;
    onSelectStrategy: (strategy: string, trade_type: string) => void;
};
type TStrategyTypes = { type: string; items: TStrategyTradeAssociations }[];

const StrategyBlock = ({ title, items, onSelectStrategy }: TStrategyBlock) => {
    return items.length > 0 ? (
        <div className='strategy-template-picker__strategy'>
            <div className='strategy-template-picker__title'>
                <Text size='xs' weight='bold'>
                    {title}
                </Text>
            </div>
            {items.map((item, index) => (
                <div className='strategy-template-picker__links' key={index}>
                    <Link hasChevron size='sm' onClick={() => onSelectStrategy(item.name, title)}>
                        {item.display_name}
                    </Link>
                </div>
            ))}
        </div>
    ) : null;
};

const StrategyList = ({ search_value = '', is_searching = false, onSelectStrategy }: TStrategyListProps) => {
    const martingale = STRATEGY_TRADE_ASSOCIATIONS.filter(item => item.name === 'MARTINGALE');

    const visible = is_searching && search_value
        ? martingale.filter(item => item.display_name.toLowerCase().includes(search_value.toLowerCase()))
        : martingale;

    return (
        <div className='strategy-template-picker__strategies'>
            <StrategyBlock
                title={localize('Options')}
                items={visible}
                onSelectStrategy={onSelectStrategy}
            />
        </div>
    );
};

export default StrategyList;
