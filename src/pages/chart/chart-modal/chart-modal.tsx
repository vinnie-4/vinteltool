import React from 'react';
import { observer } from 'mobx-react-lite';
import DraggableResizeWrapper from '@/components/draggable/draggable-resize-wrapper';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import ChartWrapper from '../chart-wrapper';
import ChartModalDesktop from './chart-modal-desktop';

export const ChartModal = observer(() => {
    const { dashboard } = useStore();
    const { is_chart_modal_visible, setChartModalVisibility } = dashboard;
    const { isDesktop } = useDevice();

    if (isDesktop) return <ChartModalDesktop />;

    return (
        <React.Fragment>
            {is_chart_modal_visible && (
                <DraggableResizeWrapper
                    boundary='.main'
                    header={localize('Chart')}
                    onClose={setChartModalVisibility}
                    modalWidth={360}
                    modalHeight={560}
                    minWidth={280}
                    minHeight={400}
                    enableResizing={false}
                    enableDragging={false}
                >
                    <div
                        className='chart-modal-dialog'
                        data-testid='chart-modal-dialog'
                        style={{ height: 'calc(100% - 6rem)', width: '100%', overflow: 'hidden' }}
                    >
                        <ChartWrapper show_digits_stats={false} />
                    </div>
                </DraggableResizeWrapper>
            )}
        </React.Fragment>
    );
});

export default ChartModal;
