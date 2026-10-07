import { observer } from 'mobx-react-lite';
import LDP from './ldp';
import './chart.scss';

const Chart = observer(() => (
    <div className='dashboard__chart-wrapper dashboard__chart-wrapper--ldp' dir='ltr'>
        <LDP />
    </div>
));

export default Chart;
