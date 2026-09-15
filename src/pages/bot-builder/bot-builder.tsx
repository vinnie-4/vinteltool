import React from 'react';
import { observer } from 'mobx-react-lite';
import Flyout from '@/components/flyout';
import { useStore } from '@/hooks/useStore';
import StopBotModal from '../dashboard/stop-bot-modal';
import Toolbar from './toolbar';
import Toolbox from './toolbox';
import './workspace.scss';

const BotBuilder = observer(() => {
    const { blockly_store } = useStore();
    const { is_loading } = blockly_store;
    const [workspace, setWorkspace] = React.useState<any>(null);
    const is_workspace_alignment_registered = React.useRef(false);

    const alignWorkspaceBlocks = React.useCallback(() => {
        const workspace = window.Blockly?.derivWorkspace;
        if (!workspace) return;

        workspace.scroll(0, 0);

        const top_blocks = workspace.getTopBlocks(false);
        if (!top_blocks?.length) return;

        // Start the draggable blocks 15px below the top edge of the workspace.
        let y = 15;
        top_blocks.forEach(block => {
            block.moveBy(10 - block.getRelativeToSurfaceXY().x, y - block.getRelativeToSurfaceXY().y);
            y += block.getHeightWidth().height + 30;
        });

        workspace.scroll(0, 0);
    }, []);

    React.useEffect(() => {
        const workspace = window.Blockly?.derivWorkspace;
        if (!workspace || is_workspace_alignment_registered.current) return;

        const handleWorkspaceLoaded = (event: any) => {
            if (event?.type === window.Blockly.Events.FINISHED_LOADING) {
                requestAnimationFrame(() => alignWorkspaceBlocks());
            }
        };

        workspace.addChangeListener(handleWorkspaceLoaded);
        is_workspace_alignment_registered.current = true;

        const timer = window.setTimeout(alignWorkspaceBlocks, 0);

        return () => {
            window.clearTimeout(timer);
            workspace.removeChangeListener(handleWorkspaceLoaded);
            is_workspace_alignment_registered.current = false;
        };
    }, [is_loading, alignWorkspaceBlocks]);

    if (is_loading) return null;

    return null;
});

export default BotBuilder;