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
        return () => onUnmount();
    }, []);

    React.useEffect(() => {
        if (is_loading) return;

        let workspace: any = null;
        let pollTimer: number | null = null;
        let retryTimer: number | null = null;

        const alignBlocksToLeftMargin = () => {
            if (!workspace) return;
            const topBlocks = workspace.getTopBlocks(false);
            if (!topBlocks?.length) return;

            workspace.scroll(0, 0);

            // Keep the requested horizontal margin and move the first block to Y=0.
            const targetX = 10;
            let currentY = 0;

            topBlocks.forEach((block: any) => {
                const blockXY = block.getRelativeToSurfaceXY();
                const dx = targetX - blockXY.x;
                const dy = currentY - blockXY.y;
                if (dx !== 0 || dy !== 0) block.moveBy(dx, dy);
                currentY += block.getHeightWidth().height + 30;
            });

            workspace.scroll(0, 0);
        };

        const applyAlignment = () => {
            alignBlocksToLeftMargin();
            requestAnimationFrame(() => {
                alignBlocksToLeftMargin();
                retryTimer = window.setTimeout(alignBlocksToLeftMargin, 100);
            });
        };

        const attachToWorkspace = () => {
            workspace = window.Blockly?.derivWorkspace;
            if (!workspace) {
                pollTimer = window.setTimeout(attachToWorkspace, 50);
                return;
            }

            const handleChange = (event: { type?: string }) => {
                if (event.type === window.Blockly?.Events?.FINISHED_LOADING) applyAlignment();
            };

            workspace.addChangeListener(handleChange);
            applyAlignment();
            return () => workspace?.removeChangeListener(handleChange);
        };

        let detach: (() => void) | undefined;
        detach = attachToWorkspace();

        return () => {
            if (pollTimer !== null) window.clearTimeout(pollTimer);
            if (retryTimer !== null) window.clearTimeout(retryTimer);
            detach?.();
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
