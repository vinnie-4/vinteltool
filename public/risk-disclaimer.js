(function () {
    function initRiskDisclaimer() {
        if (document.getElementById('vintel-risk-disclaimer-button')) return;

        var button = document.createElement('button');
        button.id = 'vintel-risk-disclaimer-button';
        button.type = 'button';
        button.setAttribute('aria-label', 'Risk Disclaimer');
        button.textContent = '⚠️ Risk Disclaimer';
        button.style.cssText = [
            'position:fixed',
            'left:14px',
            'bottom:150px',
            'z-index:2147483000',
            'border:0',
            'border-radius:7px',
            'background:#f5c400',
            'color:#111',
            'padding:9px 12px',
            'font:700 14px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
            'box-shadow:0 3px 12px rgba(0,0,0,.35)',
            'cursor:pointer',
            'white-space:nowrap',
            'touch-action:manipulation'
        ].join(';');

        var overlay = document.createElement('div');
        overlay.id = 'vintel-risk-disclaimer-overlay';
        overlay.style.cssText = [
            'display:none',
            'position:fixed',
            'inset:0',
            'z-index:2147483001',
            'background:rgba(0,0,0,.48)',
            'align-items:center',
            'justify-content:center',
            'padding:16px',
            'box-sizing:border-box'
        ].join(';');

        var modal = document.createElement('div');
        modal.style.cssText = [
            'position:relative',
            'width:min(576px,100%)',
            'max-height:82vh',
            'overflow:auto',
            'box-sizing:border-box',
            'background:#fff',
            'color:#555',
            'border-radius:14px',
            'padding:24px 28px',
            'font:400 16px/1.7 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
            'box-shadow:0 16px 50px rgba(0,0,0,.35)'
        ].join(';');

        modal.innerHTML = '<button type="button" aria-label="Close" data-risk-close style="position:absolute;right:14px;top:12px;border:0;background:transparent;color:#888;font-size:25px;line-height:1;cursor:pointer">×</button>' +
            '<h2 style="margin:0 34px 8px 0;color:#3d3d3d;font-size:20px;line-height:1.3">Risk Disclaimer</h2>' +
            '<p>Deriv offers complex derivatives, such as options and contracts for difference (“CFDs”). These products may not be suitable for all clients, and trading them puts you at risk. Please make sure that you understand the following risks before trading Deriv products:</p>' +
            '<ul style="padding-left:30px;margin:10px 0 16px"><li>You may lose some or all of the money you invest in the trade.</li><li>If your trade involves currency conversion, exchange rates will affect your profit and loss.</li></ul>' +
            '<p>You should never trade with borrowed money or with money that you cannot afford to lose.</p>' +
            '<button type="button" data-risk-close style="border:0;border-radius:5px;background:#12e000;color:#111;padding:8px 10px;font-size:16px;cursor:pointer">Close</button>';

        overlay.appendChild(modal);
        document.body.appendChild(button);
        document.body.appendChild(overlay);

        function closeModal() {
            overlay.style.display = 'none';
        }

        button.addEventListener('click', function () {
            overlay.style.display = 'flex';
        });
        overlay.addEventListener('click', function (event) {
            if (event.target === overlay || event.target.hasAttribute('data-risk-close')) closeModal();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRiskDisclaimer);
    } else {
        initRiskDisclaimer();
    }
})();
