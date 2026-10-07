import { observer } from 'mobx-react-lite';
import LDP from './ldp';
import './chart.scss';

const Chart = observer((_: { show_digits_stats?: boolean }) => (
    <div className='dashboard__chart-wrapper dashboard__chart-wrapper--ldp' dir='ltr'>
        <LDP />
    </div>
));

export default Chart;
