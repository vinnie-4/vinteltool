// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import { action, makeObservable, observable } from 'mobx';
import { config, load, runGroupedEvents } from '@/external/bot-skeleton';
import RootStore from './root-store';

interface IToolbarStore {
    is_animation_info_modal_open: boolean;
    is_dialog_open: boolean;
    file_name: string;
    has_undo_stack: boolean;
    has_redo_stack: boolean;
    is_reset_button_clicked: boolean;
    onResetClick: () => void;
    closeResetDialog: () => void;
    onResetOkButtonClick: () => void;
    onSortClick: () => void;
    onUndoClick: (is_redo: boolean) => void;
    onZoomInOutClick: (is_zoom_in: boolean) => void;
    resetDefaultStrategy: () => void;
    setHasUndoStack: () => void;
    setHasRedoStack: () => void;
}

export default class ToolbarStore implements IToolbarStore {
    root_store: RootStore;

    constructor(root_store: RootStore) {
        makeObservable(this, {
            is_animation_info_modal_open: observable,
            is_dialog_open: observable,
            file_name: observable,
            has_undo_stack: observable,
            has_redo_stack: observable,
            is_reset_button_clicked: observable,
            onResetClick: action.bound,
            closeResetDialog: action.bound,
            onResetOkButtonClick: action.bound,
            onUndoClick: action.bound,
            resetDefaultStrategy: action.bound,
            setHasUndoStack: action.bound,
            setHasRedoStack: action.bound,
        });

        this.root_store = root_store;
    }

    is_animation_info_modal_open = false;
    is_dialog_open = false;
    file_name = config().default_file_name;
    has_undo_stack = false;
    has_redo_stack = false;
    is_reset_button_clicked = false;

    setResetButtonState = (is_reset_button_clicked: boolean): void => {
        this.is_reset_button_clicked = is_reset_button_clicked;
    };

    onResetClick = (): void => {
        this.is_dialog_open = true;
    };

    closeResetDialog = (): void => {
        this.is_dialog_open = false;
    };

    onResetOkButtonClick = (): void => {
        this.setResetButtonState(true);
        // Mark the next Bot Builder initialization as an explicit reset so the
        // normal recent-workspace restoration cannot put old block coordinates
        // back into the workspace after the page refreshes.
        try {
            window.sessionStorage.setItem('vinteltool-reset-to-default', 'true');
        } catch {
            // Ignore storage failures and continue with the reset.
        }
        this.is_dialog_open = false;
        window.location.reload();
    };

    resetDefaultStrategy = async () => {
        const workspace = window.Blockly?.derivWorkspace;
        const default_xml = workspace?.cached_xml?.main;

        if (!workspace || !default_xml) {
            this.setResetButtonState(false);
            return;
        }

        // Reset the existing Blockly workspace in-place. Do not call the full `load()`
        // pipeline here: that pipeline toggles the global loading state and can cause
        // Bot Builder to fall into the interruption/error screen when resetting an
        // already-imported strategy.
        window.Blockly.Events.setGroup('reset');
        workspace.clear();

        try {
            const xml = window.Blockly.utils.xml.textToDom(default_xml);
            window.Blockly.Xml.domToWorkspace(xml, workspace);
            workspace.current_strategy_id = window?.Blockly?.utils?.idGenerator?.genUid();
            workspace.strategy_to_load = default_xml;
            workspace.clearUndo();
            workspace.scroll(0, 0);
        } catch (error) {
            console.error('Unable to restore Bot Builder default workspace', error); // eslint-disable-line
        } finally {
            window.Blockly.Events.setGroup(false);
            this.setResetButtonState(false);
        }
    };

    onSortClick = () => {
        const {
            workspaces: {
                indentWorkspace: { x, y },
            },
        } = config();
        window.Blockly.derivWorkspace.cleanUp(x, y);
    };

    onUndoClick = (is_redo: boolean): void => {
        window.Blockly.Events.setGroup('undo_clicked');
        window.Blockly.derivWorkspace.undo(is_redo);
        window.Blockly.svgResize(window.Blockly.derivWorkspace); // Called for CommentDelete event.
        this.setHasRedoStack();
        this.setHasUndoStack();
        window.Blockly.Events.setGroup(false);
    };

    onZoomInOutClick = (is_zoom_in: boolean): void => {
        const workspace = window.Blockly.derivWorkspace;
        const metrics = workspace.getMetrics();
        const addition = is_zoom_in ? 1 : -1;

        workspace.zoom(metrics.viewWidth / 2, metrics.viewHeight / 2, addition);
    };

    setHasUndoStack = (): void => {
        this.has_undo_stack = window.Blockly.derivWorkspace?.undoStack_?.length > 0;
    };

    setHasRedoStack = (): void => {
        this.has_redo_stack = window.Blockly.derivWorkspace?.redoStack_?.length > 0;
    };
}
