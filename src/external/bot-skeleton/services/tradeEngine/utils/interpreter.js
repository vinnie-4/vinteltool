import { isMultiplierContract } from '@/components/shared';
import cloneThorough from '@/utils/clone';
import JSInterpreter from '@deriv/js-interpreter';
import { unrecoverable_errors } from '../../../constants/messages';
import { observer as globalObserver } from '../../../utils/observer';
import { api_base } from '../../api/api-base';
import Interface from '../Interface';
import { createScope } from './cliTools';

JSInterpreter.prototype.takeStateSnapshot = function () {
    return cloneThorough(this.stateStack, undefined, undefined, undefined, true);
};

JSInterpreter.prototype.restoreStateSnapshot = function (snapshot) {
    this.stateStack = cloneThorough(snapshot, undefined, undefined, undefined, true);
    this.global = this.stateStack[0].scope.object || this.stateStack[0].scope;
    this.initFunc_(this, this.global);
};

const botInitialized = bot => bot && bot.tradeEngine.options;
const botStarted = bot => botInitialized(bot) && bot.tradeEngine.tradeOptions;
const shouldRestartOnError = (bot, errorName = '') => !unrecoverable_errors.includes(errorName) && botInitialized(bot) && bot.tradeEngine.options.shouldRestartOnError;
const shouldStopOnError = (bot, errorName = '') => ['SellNotAvailableCustom', 'ContractCreationFailure', 'InvalidtoBuy'].includes(errorName) && botInitialized(bot);
const timeMachineEnabled = bot => botInitialized(bot) && bot.tradeEngine.options.timeMachineEnabled;

const Interpreter = () => {
    let $scope = createScope();
    let bot = Interface($scope);
    let interpreter = {};
    let onFinish;
    let async_operation_pending = false;
    let paused_async_continuation = null;

    $scope.observer.register('REVERT', watchName => revert(watchName === 'before' ? $scope.beforeState : $scope.duringState));

    function init() {
        $scope = createScope();
        bot = Interface($scope);
        interpreter = {};
        onFinish = () => {};
        async_operation_pending = false;
        paused_async_continuation = null;
    }

    function revert(state) {
        interpreter.restoreStateSnapshot(state);
        interpreter.paused_ = false;
        async_operation_pending = false;
        paused_async_continuation = null;
        loop();
    }

    function loop() {
        if (async_operation_pending || $scope.stopped || interpreter.paused_) return;
        if (!interpreter.run()) onFinish(interpreter.pseudoToNative(interpreter.value));
    }

    function createAsync(js_interpreter, func) {
        const asyncFunc = (...args) => {
            const callback = args.pop();
            const reversed_args = args.slice().reverse();
            const first_defined_arg_idx = reversed_args.findIndex(arg => arg !== undefined);
            const function_args = first_defined_arg_idx < 0 ? [] : reversed_args.slice(first_defined_arg_idx).reverse();

            async_operation_pending = true;
            paused_async_continuation = null;

            Promise.resolve(func(...function_args.map(arg => js_interpreter.pseudoToNative(arg))))
                .then(rv => {
                    if ($scope.stopped) {
                        async_operation_pending = false;
                        paused_async_continuation = null;
                        return;
                    }

                    const continueInterpreter = () => {
                        if ($scope.stopped) return;
                        callback(js_interpreter.nativeToPseudo(rv));
                        async_operation_pending = false;
                        paused_async_continuation = null;
                        loop();
                    };

                    if (interpreter.paused_) {
                        // Keep the completed result and its continuation parked.
                        // Nothing after the async trade operation may execute until
                        // Resume explicitly releases this continuation.
                        paused_async_continuation = continueInterpreter;
                        return;
                    }

                    continueInterpreter();
                })
                .catch(e => {
                    async_operation_pending = false;
                    paused_async_continuation = null;
                    $scope.observer.emit('Error', e.error || e);
                });
        };

        Object.defineProperty(asyncFunc, 'length', { value: 101 });
        return js_interpreter.createAsyncFunction(asyncFunc);
    }

    function initFunc(js_interpreter, scope) {
        const bot_interface = bot.getInterface();
        const { getTicksInterface, alert, prompt, sleep, console: custom_console } = bot_interface;
        const ticks_interface = getTicksInterface;

        js_interpreter.setProperty(scope, 'console', js_interpreter.nativeToPseudo(custom_console));
        js_interpreter.setProperty(scope, 'alert', js_interpreter.nativeToPseudo(alert));
        js_interpreter.setProperty(scope, 'prompt', js_interpreter.nativeToPseudo(prompt));
        js_interpreter.setProperty(scope, 'getPurchaseReference', js_interpreter.nativeToPseudo(bot_interface.getPurchaseReference));

        const pseudo_bot_interface = js_interpreter.nativeToPseudo(bot_interface);
        Object.entries(ticks_interface).forEach(([name, f]) => js_interpreter.setProperty(pseudo_bot_interface, name, createAsync(js_interpreter, f)));

        js_interpreter.setProperty(pseudo_bot_interface, 'start', js_interpreter.nativeToPseudo((...args) => {
            if (shouldRestartOnError(bot)) $scope.startState = js_interpreter.takeStateSnapshot();
            bot_interface.start(...args);
        }));
        js_interpreter.setProperty(pseudo_bot_interface, 'purchase', createAsync(js_interpreter, bot_interface.purchase));
        js_interpreter.setProperty(pseudo_bot_interface, 'sellAtMarket', createAsync(js_interpreter, bot_interface.sellAtMarket));
        js_interpreter.setProperty(scope, 'Bot', pseudo_bot_interface);
        js_interpreter.setProperty(scope, 'watch', createAsync(js_interpreter, watchName => {
            const { watch } = bot.getInterface();
            if (timeMachineEnabled(bot)) {
                const snapshot = interpreter.takeStateSnapshot();
                if (watchName === 'before') $scope.beforeState = snapshot;
                else $scope.duringState = snapshot;
            }
            return watch(watchName);
        }));
        js_interpreter.setProperty(scope, 'sleep', createAsync(js_interpreter, sleep));
    }

    async function stop() {
        return new Promise((resolve, reject) => {
            try {
                const global_timeouts = globalObserver.getState('global_timeouts') ?? [];
                const is_timeouts_cancellable = Object.keys(global_timeouts).every(timeout => global_timeouts[timeout].is_cancellable);
                if (!bot.tradeEngine.contractId && is_timeouts_cancellable) {
                    api_base.is_stopping = true;
                    global_timeouts.forEach(timeout => clearTimeout(global_timeouts[timeout]));
                    terminateSession().then(() => { api_base.is_stopping = false; resolve(); });
                } else if (bot.tradeEngine.isSold === false && !$scope.is_error_triggered && isMultiplierContract(bot?.tradeEngine?.data?.contract?.contract_type ?? '')) {
                    globalObserver.register('contract.status', async contractStatus => {
                        if (contractStatus.id === 'contract.sold') terminateSession().then(() => resolve());
                    });
                } else {
                    api_base.is_stopping = true;
                    terminateSession().then(() => { api_base.is_stopping = false; resolve(); });
                }
            } catch (e) { reject(e); }
        });
    }

    async function terminateSession() {
        return new Promise((resolve, reject) => {
            try {
                $scope.stopped = true;
                $scope.is_error_triggered = false;
                interpreter.paused_ = false;
                async_operation_pending = false;
                paused_async_continuation = null;
                globalObserver.emit('bot.stop');
                api_base.clearSubscriptions();
                $scope.ticksService.unsubscribeFromTicksService().then(() => resolve());
            } catch (error) { reject(error); }
        });
    }

    async function unsubscribeFromTicksService() {
        const { ticksService } = $scope;
        return new Promise((resolve, reject) => {
            try { ticksService.unsubscribeFromTicksService().then(() => resolve()); }
            catch (e) { reject(e); }
        });
    }

    function pause() {
        if ($scope.stopped || !interpreter || typeof interpreter.run !== 'function') return false;
        interpreter.paused_ = true;
        globalObserver.emit('bot.paused');
        return true;
    }

    function resume() {
        if ($scope.stopped || !interpreter || typeof interpreter.run !== 'function') return false;
        interpreter.paused_ = false;
        globalObserver.emit('bot.resumed');

        // Exactly one continuation is released. If the async request is still
        // pending, its promise will release it later. If it completed while
        // paused, release the parked continuation now. No unconditional loop()
        // means Resume cannot execute the interpreter twice.
        if (paused_async_continuation) {
            const continuation = paused_async_continuation;
            paused_async_continuation = null;
            continuation();
        }
        return true;
    }

    function run(code) {
        return new Promise((resolve, reject) => {
            const onError = e => {
                if ($scope.stopped) return;
                if (e.code === 'InvalidToken') { globalObserver.emit('client.invalid_token'); return; }
                if (shouldStopOnError(bot, e?.code)) {
                    globalObserver.emit('ui.log.error', e.message);
                    globalObserver.emit('bot.click_stop');
                    return;
                }
                $scope.is_error_triggered = true;
                if (!shouldRestartOnError(bot, e.code) || !botStarted(bot)) { reject(e); return; }
                globalObserver.emit('Error', e);
                const { initArgs, tradeOptions } = bot.tradeEngine;
                terminateSession();
                init();
                $scope.observer.register('Error', onError);
                bot.tradeEngine.init(...initArgs);
                bot.tradeEngine.start(tradeOptions);
                if ($scope.startState && interpreter?.restoreStateSnapshot instanceof Function) revert($scope.startState);
            };
            $scope.observer.register('Error', onError);
            interpreter = new JSInterpreter(code, initFunc);
            interpreter.paused_ = false;
            async_operation_pending = false;
            paused_async_continuation = null;
            onFinish = resolve;
            loop();
        });
    }

    return { stop, run, pause, resume, terminateSession, bot, unsubscribeFromTicksService, get isPaused() { return Boolean(interpreter?.paused_); } };
};
export default Interpreter;
export const createInterpreter = () => new Interpreter();