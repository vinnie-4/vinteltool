import { observer } from 'mobx-react-lite';
import TradingViewComponent from '@/components/trading-view-chart/trading-view';
import './chart.scss';

const Chart = observer(() => (
    <div className='dashboard__chart-wrapper dashboard__chart-wrapper--trading-view' dir='ltr'>
        <TradingViewComponent />
    </div>
));

export default Chart;
