// VintelTool Quick Bot Builder — replaces the Deriv Quick Strategy selector with a
// VintelTool-owned Blockly strategy studio. The resulting XML is loaded directly into
// the existing Bot Builder workspace so the trading engine remains unchanged.

import React from 'react';
import { observer } from 'mobx-react-lite';
import MobileFullPageModal from '@/components/shared_ui/mobile-full-page-modal';
import Modal from '@/components/shared_ui/modal';
import { useStore } from '@/hooks/useStore';
import { useDevice } from '@deriv-com/ui';
import './quick-strategy.scss';

const TOOLBOX = `
<xml xmlns="https://developers.google.com/blockly/xml">
  <category name="Market setup" colour="#0066FF">
    <block type="trade_definition"></block>
    <block type="trade_definition_market"></block>
    <block type="trade_definition_tradetype"></block>
    <block type="trade_definition_contracttype"></block>
    <block type="trade_definition_candleinterval"></block>
  </category>
  <category name="Trade parameters" colour="#0EA5E9">
    <block type="trade_definition_tradeoptions"></block>
    <block type="trade_definition_multiplier"></block>
    <block type="trade_definition_accumulator"></block>
    <block type="multiplier_take_profit"></block>
    <block type="multiplier_stop_loss"></block>
    <block type="accumulator_take_profit"></block>
  </category>
  <category name="Entry logic" colour="#10B981">
    <block type="before_purchase"></block>
    <block type="purchase"></block>
    <block type="tick_analysis"></block>
    <block type="tick"></block>
    <block type="logic_compare"></block>
    <block type="logic_operation"></block>
    <block type="logic_boolean"></block>
    <block type="math_number"></block>
    <block type="math_arithmetic"></block>
  </category>
  <category name="Sell conditions" colour="#F59E0B">
    <block type="during_purchase"></block>
    <block type="sell_at_market"></block>
  </category>
  <category name="Restart / flow" colour="#8B5CF6">
    <block type="after_purchase"></block>
    <block type="trade_again"></block>
    <block type="controls_if"></block>
    <block type="controls_repeat_ext"></block>
    <block type="controls_whileUntil"></block>
  </category>
</xml>`;

const STARTER_XML = `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="trade_definition" x="24" y="24">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_indices</field>
        <field name="SUBMARKET_LIST">continuous_indices</field>
        <field name="SYMBOL_LIST">R_100</field>
        <next>
          <block type="trade_definition_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">both</field>
            <next>
              <block type="trade_definition_contracttype" deletable="false" movable="false">
                <field name="TYPE_LIST">DIGITEVEN</field>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`;

const getBlockly = () => (window as any).Blockly;

const QuickStrategy = observer(() => {
    const { quick_strategy } = useStore();
    const { isDesktop } = useDevice();
    const { is_open, setFormVisibility } = quick_strategy;
    const studio_ref = React.useRef<HTMLDivElement | null>(null);
    const workspace_ref = React.useRef<any>(null);

    const close = React.useCallback(() => setFormVisibility(false), [setFormVisibility]);

    const saveStrategy = React.useCallback(() => {
        const Blockly = getBlockly();
        const workspace = workspace_ref.current;
        if (!Blockly || !workspace) return;
        const dom = Blockly.Xml.workspaceToDom(workspace);
        localStorage.setItem('vinteltool-quick-bot-strategy', Blockly.Xml.domToText(dom));
    }, []);

    const clearStrategy = React.useCallback(() => {
        const workspace = workspace_ref.current;
        if (!workspace) return;
        workspace.clear();
        const Blockly = getBlockly();
        if (Blockly) Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(STARTER_XML), workspace);
    }, []);

    const loadToBotBuilder = React.useCallback(() => {
        const Blockly = getBlockly();
        const studio = workspace_ref.current;
        const target = Blockly?.derivWorkspace;
        if (!Blockly || !studio || !target) return;

        const dom = Blockly.Xml.workspaceToDom(studio);
        target.clear();
        Blockly.Xml.domToWorkspace(dom, target);
        target.render();
        target.resizeContents();
        close();
    }, [close]);

    React.useEffect(() => {
        if (!is_open || !studio_ref.current || workspace_ref.current) return;

        const Blockly = getBlockly();
        if (!Blockly) return;

        const workspace = Blockly.inject(studio_ref.current, {
            toolbox: TOOLBOX,
            toolboxPosition: 'start',
            collapse: false,
            trashcan: true,
            scrollbars: true,
            sounds: false,
            zoom: {
                controls: true,
                wheel: true,
                startScale: 0.82,
                maxScale: 1.35,
                minScale: 0.55,
                scaleSpeed: 1.08,
            },
            grid: {
                spacing: 20,
                length: 3,
                colour: '#d9e2ec',
                snap: true,
            },
        });

        workspace_ref.current = workspace;
        const saved = localStorage.getItem('vinteltool-quick-bot-strategy');
        const xml = saved || STARTER_XML;
        try {
            Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), workspace);
        } catch {
            Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(STARTER_XML), workspace);
        }

        const resize = () => Blockly.svgResize(workspace);
        window.addEventListener('resize', resize);
        requestAnimationFrame(resize);

        return () => {
            window.removeEventListener('resize', resize);
            workspace.dispose();
            workspace_ref.current = null;
        };
    }, [is_open]);

    const content = (
        <div className="vintel-quick-builder">
            <div className="vintel-quick-builder__hero">
                <div>
                    <span className="vintel-quick-builder__eyebrow">VINTELTOOL</span>
                    <h2>Quick Bot Builder</h2>
                    <p>Build your strategy with VintelTool blocks, then load it directly into Bot Builder.</p>
                </div>
                <div className="vintel-quick-builder__actions">
                    <button type="button" onClick={saveStrategy}>Save</button>
                    <button type="button" onClick={clearStrategy}>Clear</button>
                    <button type="button" className="primary" onClick={loadToBotBuilder}>Load to Bot Builder</button>
                </div>
            </div>
            <div className="vintel-quick-builder__guide">
                <span>Drag blocks from the left toolbox.</span>
                <span>Connect them to define your entry, contract, sell and restart logic.</span>
            </div>
            <div ref={studio_ref} className="vintel-quick-builder__workspace" />
        </div>
    );

    if (!is_open) return null;

    if (isDesktop) {
        return (
            <Modal className="modal--strategy vintel-quick-builder-modal" is_open={is_open} width="92rem">
                {content}
            </Modal>
        );
    }

    return (
        <MobileFullPageModal
            is_modal_open={is_open}
            className="quick-strategy__wrapper vintel-quick-builder-modal"
            header="Quick Bot Builder"
            onClickClose={close}
            height_offset="4rem"
        >
            {content}
        </MobileFullPageModal>
    );
});

export default QuickStrategy;
