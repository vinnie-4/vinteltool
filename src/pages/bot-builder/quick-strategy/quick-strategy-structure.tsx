import React from 'react';

const QuickStrategyStructure = () => (
    <div className='vqb-structure' aria-label='Quick Bot Builder structure'>
        <div className='vqb-structure__title'>VINTELTOOL QUICK BOT BUILDER</div>
        <div className='vqb-structure__subtitle'>Configure → Load → Native Blockly Bot Builder</div>
        <div className='vqb-structure__flow'>
            <div className='vqb-structure__step'><b>1. Strategy Template</b><span>Choose the strategy and template.</span></div>
            <div className='vqb-structure__step'><b>2. Trade Parameters</b><span>Market · Symbol · Contract · Trade type · Duration · Stake.</span></div>
            <div className='vqb-structure__step'><b>3. Strategy / Money Management</b><span>Martingale · Multiplier · Stake progression · Reset rules.</span></div>
            <div className='vqb-structure__step'><b>4. Entry / Purchase Conditions</b><span>Signal · Digit conditions · Even/Odd · Over/Under · Entry trigger.</span></div>
            <div className='vqb-structure__step'><b>5. Sell / Risk Conditions</b><span>Take Profit · Stop Loss · Optional sell conditions.</span></div>
            <div className='vqb-structure__step'><b>6. Load</b><span>Generate strategy configuration → Blockly XML → load native workspace.</span></div>
            <div className='vqb-structure__step vqb-structure__step--final'><b>7. Bot Builder</b><span>Trade Parameters → Purchase Conditions → Sell Conditions → Strategy → Run.</span></div>
        </div>
    </div>
);

export default QuickStrategyStructure;
