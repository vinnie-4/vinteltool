import React from 'react';
import { observer } from 'mobx-react-lite';
import Flyout from '@/components/flyout';
import { useStore } from '@/hooks/useStore';
import StopBotModal from '../dashboard/stop-bot-modal';
import Toolbar from './toolbar';
import Toolbox from './toolbox';
import './workspace.scss';

const WorkspaceWrapper = observer(() => {
    const { blockly_store } = useStore();
    const { onMount, onUnmount, is_loading } = blockly_store;

    React.useEffect(() => {
        onMount();
        return () => {
            onUnmount();
        };
    }, []);

    React.useEffect(() => {
        if (is_loading) return;

        const alignBlocksToLeftMargin = () => {
            const workspace = window.Blockly?.derivWorkspace;
            if (!workspace) return;

            workspace.scroll(0, 0);

            const topBlocks = workspace.getTopBlocks(false);
            let currentY = 15;
            const targetX = 10;

            topBlocks.forEach(block => {
                const blockXY = block.getRelativeToSurfaceXY();
                const dx = targetX - blockXY.x;
                const dy = currentY - blockXY.y;

                if (dx !== 0 || dy !== 0) block.moveBy(dx, dy);
                currentY += block.getHeightWidth().height + 30;
            });
        };

        const workspace = window.Blockly?.derivWorkspace;
        if (!workspace) return;

        const handleChange = (event: { type?: string }) => {
            if (event.type === window.Blockly?.Events?.FINISHED_LOADING) {
                alignBlocksToLeftMargin();
            }
        };

        workspace.addChangeListener(handleChange);
        const timer = window.setTimeout(alignBlocksToLeftMargin, 0);

        return () => {
            window.clearTimeout(timer);
            workspace.removeChangeListener(handleChange);
        };
    }, [is_loading]);

    if (is_loading) return null;

    if (window.Blockly?.derivWorkspace)
        return (
            <React.Fragment>
                <Toolbox />
                <Toolbar />
                <Flyout />
                <StopBotModal />
            </React.Fragment>
        );

    return null;
});

export default WorkspaceWrapper;
