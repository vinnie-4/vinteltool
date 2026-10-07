import React from 'react';
import { observer } from 'mobx-react-lite';
import DraggableResizeWrapper from '@/components/draggable/draggable-resize-wrapper';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import ChartWrapper from '../chart-wrapper';

const ChartModalDesktop = observer(() => {
    const { dashboard } = useStore();
    const { is_chart_modal_visible, setChartModalVisibility } = dashboard;
    const modalWidth = Math.min(Math.round(window.innerWidth * 0.72), 760);
    const modalHeight = Math.min(Math.round(window.innerHeight * 0.78), 720);

    if (!is_chart_modal_visible) return null;

    return (
        <div className='chart-modal-overlay' onMouseDown={setChartModalVisibility}>
            <div onMouseDown={event => event.stopPropagation()}>
                <DraggableResizeWrapper
                    boundary='.main'
                    header={localize('📊 LDP · Last Digit')}
                    onClose={setChartModalVisibility}
                    modalWidth={modalWidth}
                    modalHeight={modalHeight}
                    minWidth={modalWidth}
                    minHeight={modalHeight}
                    enableResizing={false}
                    enableDragging={false}
                >
                    <div className='chart-modal-dialog' data-testid='chart-modal-dialog'>
                        <ChartWrapper show_digits_stats={false} />
                    </div>
                </DraggableResizeWrapper>
            </div>
        </div>
    );
});

export default ChartModalDesktop;
