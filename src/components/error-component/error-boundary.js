import React from 'react';
import PropTypes from 'prop-types';
import ErrorComponent from './index';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    componentDidCatch = (error, info) => {
        if (window.TrackJS) window.TrackJS.console.log(this.props.root_store);
        console.error('[ErrorBoundary] Caught render error:', error, info);

        // Do not turn an expected bot-stop exception into the global
        // "Sorry for the interruption. Refresh" screen. The stop action is
        // already guarded by the run-panel store; this is the final UI guard.
        const message = String(error?.message || error || '').toLowerCase();
        const stopRelated =
            message.includes('stopbot') ||
            message.includes('terminatebot') ||
            message.includes('bot stop') ||
            message.includes('bot-stop') ||
            message.includes('execution stopped');

        if (stopRelated) {
            this.setState({ hasError: false });
            return;
        }

        this.setState({
            hasError: true,
            error,
            info,
        });
    };

    render = () => (this.state.hasError ? <ErrorComponent should_show_refresh={true} /> : this.props.children);
}

ErrorBoundary.propTypes = {
    root_store: PropTypes.object,
    children: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.node), PropTypes.node]),
};

export default ErrorBoundary;
