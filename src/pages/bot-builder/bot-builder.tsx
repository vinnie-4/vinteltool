// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { botNotification } from '@/components/bot-notification/bot-notification';
import { notification_message } from '@/components/bot-notification/bot-notification-utils';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import { TBlocklyEvents } from 'Types';
import LoadModal from '../../components/load-modal';
import SaveModal from '../dashboard/bot-list/save-modal';
import BotBuilderTourHandler from '../tutorials/dbot-tours/bot-builder-tour';
import QuickStrategy1 from './quick-strategy';
import WorkspaceWrapper from './workspace-wrapper';

const BotBuilder = observer(() => {
    const { dashboard, app, run_panel, toolbar, quick_strategy, blockly_store } = useStore();
    const { active_tab, active_tour, is_preview_on_popup } = dashboard;
    const { is_open } = quick_strategy;
    const { is_running } = run_panel;
    const { is_loading } = blockly_store;
    const { onMount, onUnmount } = app;
    const is_blockly_listener_registered = React.useRef(false);
    const is_blockly_delete_listener_registered = React.useRef(false);
    const is_workspace_alignment_registered = React.useRef(false);
    const { isDesktop } = useDevice();
    const el_ref = React.useRef<HTMLInputElement | null>(null);

    // TODO: fix
    // const isMounted = useIsMounted();
    // const { data: remote_config_data } = useRemoteConfig(isMounted());
    let deleted_block_id: null | string = null;

    React.useEffect(() => {
        onMount();
        return () => onUnmount();
    }, [onMount, onUnmount]);

    const alignWorkspaceBlocks = React.useCallback(() => {
        const workspace = window.Blockly?.derivWorkspace;
        if (!workspace) return;

        // Reset Blockly's viewport first so the workspace origin is visible.
        workspace.scroll(0, 0);

        const top_blocks = workspace.getTopBlocks(false);
        if (!top_blocks?.length) return;

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
                requestAnimationFrame(() => {
                    alignWorkspaceBlocks();
                });
            }
        };

        workspace.addChangeListener(handleWorkspaceLoaded);
        is_workspace_alignment_registered.current = true;

        // Also align the initial workspace after Blockly has completed rendering.
        const timer = window.setTimeout(alignWorkspaceBlocks, 0);

        return () => {
            window.clearTimeout(timer);
            workspace.removeChangeListener(handleWorkspaceLoaded);
            is_workspace_alignment_registered.current = false;
        };
    }, [is_loading, alignWorkspaceBlocks]);

    React.useEffect(() => {
        const workspace = window.Blockly?.derivWorkspace;
        if (workspace && is_running && !is_blockly_listener_registered.current) {
            is_blockly_listener_registered.current = true;
            workspace.addChangeListener(handleBlockChangeOnBotRun);
        } else {
            removeBlockChangeListener();
        }

        return () => {
            if (workspace && is_blockly_listener_registered.current) {
                removeBlockChangeListener();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [is_running]);

    const handleBlockChangeOnBotRun = (e: Event) => {
        const { is_reset_button_clicked } = toolbar;
        if (e.type !== 'selected' && !is_reset_button_clicked) {
            botNotification(notification_message().workspace_change);
            removeBlockChangeListener();
        } else if (is_reset_button_clicked) {
            removeBlockChangeListener();
        }
    };

    const removeBlockChangeListener = () => {
        is_blockly_listener_registered.current = false;
        window.Blockly?.derivWorkspace?.removeChangeListener(handleBlockChangeOnBotRun);
    };
    React.useEffect(() => {
        const workspace = window.Blockly?.derivWorkspace;
        if (workspace && !is_blockly_delete_listener_registered.current) {
            is_blockly_delete_listener_registered.current = true;
            workspace.addChangeListener(handleBlockDelete);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [is_loading]);

    const handleBlockDelete = (e: TBlocklyEvents) => {
        const { is_reset_button_clicked, setResetButtonState } = toolbar;
        if (e.type === 'undo') {
            deleted_block_id = null;
            return;
        }
        if (e.type === 'delete' && !is_reset_button_clicked) {
            deleted_block_id = e.blockId;
        }
        if (e.type === 'selected' && deleted_block_id === e.oldElementId) {
            handleBlockDeleteNotification();
            deleted_block_id = null;
        }
        if (
            e.type === 'change' &&
            e.name === 'AMOUNT_LIMITS' &&
            e.newValue === '(min: 0.35 - max: 50000)' &&
            is_reset_button_clicked
        ) {
            setResetButtonState(false);
        }
    };

    const handleBlockDeleteNotification = () => {
        botNotification(notification_message().block_delete, {
            label: localize('Undo'),
            onClick: closeToast => {
                window.Blockly.derivWorkspace.undo();
                closeToast?.();
            },
        });
    };

    return (
        <>
            <div
                className={classNames('bot-builder', {
                    'bot-builder--active': active_tab === 1 && !is_preview_on_popup,
                    'bot-builder--inactive': is_preview_on_popup,
                    'bot-builder--tour-active': active_tour,
                })}
            >
                <div id='scratch_div' ref={el_ref}>
                    <WorkspaceWrapper />
                </div>
            </div>
            {active_tab === 1 && <BotBuilderTourHandler is_mobile={!isDesktop} />}
            {/* removed this outside from toolbar becuase it needs to loaded seperately without dependency */}
            <LoadModal />
            <SaveModal />
            {is_open && <QuickStrategy1 />}
        </>
    );
});

export default BotBuilder;
