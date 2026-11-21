import { isDeepStrictEqual } from 'node:util';
import { safeTransportError, type GenerationTransportDiagnostics } from '../../src/shared/generation-contract';
import { GenerationRunRepository, type OpenGenerationRunRequest, type RunBinding, type GenerationExecutionReceipt, type GenerationUsageReceipt } from '../repositories/generation-run-repository';
import type { ProviderUsagePolicy } from '../../src/shared/generation-contract';
import { parseAgentResponseProtocol, projectInterruptedAgentVisibleText } from '../../src/shared/agent-response-protocol';
import { createSingleCallWatchdog, resolveCallDeadline, resolveSingleCallTimeoutMs, runDeadlineTimeout, type DeadlineTimeoutFailureCode, type SingleCallPhase } from '../../src/shared/generation-call-timeout';
export type { OpenGenerationRunRequest, RunBinding, DurableGenerationRun, GenerationExecutionReceipt, GenerationBudgetReceipt } from '../repositories/generation-run-repository';
export interface VisibleGenerationEvent {
    kind: 'delta' | 'cumulative';
    text: string;
    eventId?: string;
}
export interface GenerationProviderUsage {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    reasoningTokens: number | null;
    accounting: 'included-in-completion' | 'separately-billed' | 'unknown';
    totalIncludesReasoning: boolean;
    /** Set only by the trusted provider adapter for a known protocol. */
    trusted: boolean;
}
export interface GenerationDispatchResult {
    usage: GenerationProviderUsage | null;
    finishReason: string | null;
}
export interface GenerationUnsavedTail {
    attemptId: string;
    artifactId: string;
    durableRevision: number;
    text: string;
    failureCode: 'GENERATION_STORAGE_FAILED';
}
/** Internal main-only request. The IPC controller supplies the frozen plan and lease, never renderer estimates. */
export interface ExecuteGenerationRequest {
    runId: string;
    invocationNonce: string;
    requestHash: string;
    providerRequest: unknown;
    reservedTokens: number;
    requestedOutputTokens: number;
    inputUpperBoundTokens: number;
    reasoningUpperBoundTokens: number;
    usagePolicy: ProviderUsagePolicy;
    purpose?: string;
    budgetDecision?: import('../../src/services/generation/task-budget-planner').TaskBudgetDecision;
    /** Main-only output projection selected from the frozen Agent tool manifest. */
    agentToolNames?: readonly string[];
    /** The original semantic task is committed with the reservation before dispatch. */
    replayTask?: import('../../src/services/generation/generation-harness').GenerationTask;
    /** 首稿提示经主进程复核确实带有生成前定稿对账注入块；恢复据此决定续写/压缩是否沿用对账结果。 */
    reconciliationInjected?: boolean;
}
export interface GenerationRunServiceDependencies {
    repository: GenerationRunRepository;
    dispatch: (request: unknown, options: {
        signal: AbortSignal;
        onVisible: (event: VisibleGenerationEvent) => void;
        onReasoning?: (text: string) => void;
        onDiagnostics?: (diagnostics: GenerationTransportDiagnostics) => void;
    }) => Promise<GenerationDispatchResult>;
    /** Renderer-only projection. Reasoning never enters an artifact or receipt. */
    onReasoning?: (event: { runId: string; rootActionId: string; attemptId: string; text: string }) => void;
    onSnapshot?: (event: {
        attemptId: string;
        visibleText: string;
        durableText: string;
        durableRevision: number;
        storageFailed: boolean;
        diagnostics?: GenerationTransportDiagnostics;
    }) => void;
    validateRecovery?: (previous: RunBinding, next: RunBinding) => Promise<boolean>;
    /**
     * D9：单次调用上限的注入点（验收脚本把 10 分钟压到秒级用）。
     * 缺省/非法值一律回落 `DEFAULT_SINGLE_CALL_TIMEOUT_MS`，生产调用方不传，语义与接卡前完全一致。
     */
    callTimeoutCapMs?: number;
    /**
     * D9：单次调用的阶段态出口（`generating` → `timed-out` / `failed`）。
     * 只报状态、不参与判定；`timed-out` 的收尾仍由 `block(root, code)` 那条路径决定。
     */
    onCallPhase?: (event: { attemptId: string; phase: SingleCallPhase }) => void;
}
export function settleProviderUsage(usage: GenerationProviderUsage | null, policy: ProviderUsagePolicy): GenerationUsageReceipt {
    const conservative: GenerationUsageReceipt = { policy, trusted: false };
    if (!usage?.trusted)
        return conservative;
    const { promptTokens: p, completionTokens: c, reasoningTokens: r, totalTokens: t } = usage;
    if (p === null || c === null || !Number.isSafeInteger(p) || !Number.isSafeInteger(c) || p < 0 || c < 0
        || r !== null && (!Number.isSafeInteger(r) || r < 0) || t !== null && (!Number.isSafeInteger(t) || t < 0))
        return conservative;
    if (policy.reasoning === 'unknown') {
        // Trust only a reported, arithmetically consistent total. The adapter's
        // protocol label cannot establish an unknown supplier's billing rules.
        if (t === null || !Number.isSafeInteger(p + c)
            || !(t === p + c && (r === null || r <= c) || r !== null && t === p + c + r)) return conservative;
        return { policy, trusted: true, inputTokens: p, completionTokens: c,
            ...(r !== null ? { reasoningTokens: r } : {}), actualTokens: t };
    }
    if (usage.accounting === 'unknown' || usage.accounting !== policy.reasoning)
        return conservative;
    if (usage.accounting === 'included-in-completion' && r !== null && r > c)
        return conservative;
    if (usage.accounting === 'separately-billed' && r === null)
        return conservative;
    const actual = p + c + (usage.accounting === 'separately-billed' ? r! : 0);
    const expectedTotal = p + c + (usage.accounting === 'separately-billed' && usage.totalIncludesReasoning ? r! : 0);
    if (t !== null && t !== expectedTotal || !Number.isSafeInteger(actual))
        return conservative;
    return { policy, trusted: true, inputTokens: p, completionTokens: c, ...(r !== null ? { reasoningTokens: r } : {}), actualTokens: actual };
}
/**
 * D9 验收注入点：把单次调用上限压到秒级，才能在实机上一次跑完「真超时中止」。
 * 生产/开发环境不设这个变量，取值即 `undefined`，回落 `DEFAULT_SINGLE_CALL_TIMEOUT_MS`。
 * 非法值同样按未设置处理——不因一个环境变量放宽护栏。
 */
function acceptanceCallTimeoutCapMs(): number | undefined {
    const raw = process.env.AI_NOVEL_CALL_TIMEOUT_CAP_MS;
    if (!raw || !/^\d+$/u.test(raw.trim()))
        return undefined;
    const parsed = Number(raw.trim());
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function createGenerationRunService(deps: GenerationRunServiceDependencies) {    const controllers = new Map<string, {
        controller: AbortController;
        rootId: string;
        flush: () => void;
        suspend: () => void;
    }>(), pending = new Map<string, Promise<GenerationExecutionReceipt>>();
    const failedRoots = new Set<string>();
    const unsavedTails = new Map<string, GenerationUnsavedTail>();
    const execute = async (request: ExecuteGenerationRequest): Promise<GenerationExecutionReceipt> => {
        const requestHash = request.requestHash;
        if (!/^[a-f0-9]{64}$/u.test(requestHash))
            throw new Error('GENERATION_REQUEST_HASH_INVALID');
        const key = JSON.stringify([request.runId, request.invocationNonce]);
        const existing = deps.repository.findInvocation(request.runId, request.invocationNonce, requestHash);
        if (existing)
            return pending.get(key) ?? existing;
        if (pending.has(key))
            return pending.get(key)!;
        const operation = (async () => {
            const run = deps.repository.get(request.runId);
            if (failedRoots.has(run.rootActionId))
                throw new Error('GENERATION_STORAGE_FAILED');
            const { usagePolicy: policy } = request;
            if (typeof policy.canBoundTotalLiability !== 'boolean' || !policy.estimatorVersion || !Number.isSafeInteger(policy.safetyMarginTokens) || policy.safetyMarginTokens < 0
                || ![request.inputUpperBoundTokens, request.reasoningUpperBoundTokens].every(v => Number.isSafeInteger(v) && v >= 0)
                || request.reservedTokens < request.inputUpperBoundTokens + request.requestedOutputTokens + request.reasoningUpperBoundTokens + policy.safetyMarginTokens)
                throw new Error('GENERATION_RESERVATION_INVALID');
            let receipt: GenerationExecutionReceipt;
            try {
                receipt = deps.repository.reserve(request.runId, request.invocationNonce, requestHash, request.reservedTokens, request.requestedOutputTokens, policy, request.purpose, request.replayTask, request.budgetDecision, request.reconciliationInjected);
            }
            catch (error) {
                if (!/BUDGET|RESERVATION|EPOCH|DISPATCH|INVOCATION/.test(error instanceof Error ? error.message : '')) {
                    failedRoots.add(run.rootActionId);
                    try {
                        deps.repository.block(run.rootActionId, 'GENERATION_STORAGE_FAILED');
                    }
                    catch { /* The in-memory failure fence remains authoritative if storage is unavailable. */ }
                }
                throw error;
            }
            if (receipt.attempt.status !== 'reserved')
                return receipt;
            const attemptId = receipt.attempt.attemptId, controller = new AbortController();
            let text = receipt.artifact!.text, durable = text, revision = receipt.artifact!.revision, storageFailed = false, streamFailed = false, terminal = false, suspended = false;
            let diagnostics: GenerationTransportDiagnostics | undefined;
            let diagnosticsAt = performance.now();
            let agentProtocolText = '';
            const events = new Map<string, string>();
            const notify = () => { try {
                deps.onSnapshot?.({ attemptId, visibleText: text, durableText: durable, durableRevision: revision, storageFailed, diagnostics });
            }
            catch { /* UI notification cannot alter durable accounting */ } };
            const flush = () => {
                if (storageFailed || text === durable)
                    return;
                try {
                    const artifact = deps.repository.snapshot(attemptId, revision, text);
                    revision = artifact.revision;
                    durable = artifact.text;
                }
                catch {
                    storageFailed = true;
                    unsavedTails.set(attemptId, Object.freeze({ attemptId, artifactId: receipt.artifact!.artifactId,
                        durableRevision: revision, text: text.slice(durable.length), failureCode: 'GENERATION_STORAGE_FAILED' }));
                    failedRoots.add(run.rootActionId);
                    controller.abort();
                    try {
                        deps.repository.block(run.rootActionId, 'GENERATION_STORAGE_FAILED');
                    }
                    catch { /* retain copyable tail in memory */ }
                }
                notify();
            };
            const retainInterruptedAgentText = () => {
                if (request.agentToolNames && !text && !suspended)
                    text = projectInterruptedAgentVisibleText(agentProtocolText, request.agentToolNames);
            };
            controllers.set(attemptId, { controller, rootId: run.rootActionId, flush: () => { retainInterruptedAgentText(); flush(); },
                suspend: () => { receipt = deps.repository.receipt(attemptId); suspended = true; controller.abort(); } });
            let timer: ReturnType<typeof setInterval> | undefined;
            let callWatchdog: ReturnType<typeof createSingleCallWatchdog> | undefined;
            /** D9：阶段态只上报、不参与判定；未接 watchdog 时静默。 */
            const reportCallPhase = () => {
                if (!callWatchdog)
                    return;
                try {
                    deps.onCallPhase?.({ attemptId, phase: callWatchdog.phase });
                }
                catch { /* A display-only event cannot alter durable generation. */ }
            };
            let removeAbortListener = () => { };
            let timedOut = false;
            /** 超时的归属：固定 per-call 上限还是 root 剩余预算。只由那一条 deadline 计时器写入。 */
            let timeoutFailureCode: DeadlineTimeoutFailureCode | null = null;
            try {
                try {
                    deps.repository.markDispatched(attemptId);
                }
                catch (error) {
                    storageFailed = true;
                    failedRoots.add(run.rootActionId);
                    try {
                        deps.repository.block(run.rootActionId, 'GENERATION_STORAGE_FAILED');
                    }
                    catch { /* The in-memory failure fence remains authoritative if storage is unavailable. */ }
                    throw error;
                }
                timer = setInterval(flush, 1000);
                // D9：单次调用固定上限（默认 10 分钟）与 root 剩余预算取更早者，**复用同一条 deadline**。
                // 预算充裕时由上限定值；预算紧张时由剩余定值。另起计时器会造出第三条判定来源。
                // 上限可注入（`callTimeoutCapMs`）只为验收把 10 分钟压到秒级；不传即默认值，语义不变。
                const budgetRemainingMs = Math.max(0, receipt.budget.policy.maxActiveElapsedMs - deps.repository.budget(run.rootActionId).activeElapsedMs);
                const capMs = resolveSingleCallTimeoutMs(deps.callTimeoutCapMs ?? acceptanceCallTimeoutCapMs());
                const callDeadline = resolveCallDeadline(budgetRemainingMs, capMs);
                // 唯一计时器：watchdog 既计时又持有阶段态（generating → timed-out/failed），
                // 触发时仍走 runDeadlineTimeout 的 mark → block → abort 顺序，block 收尾路径原样不动。
                // `Math.max(1, …)` 防止 0 预算被 resolveSingleCallTimeoutMs 的回落规则放大成 10 分钟。
                callWatchdog = createSingleCallWatchdog({
                    timeoutMs: Math.max(1, callDeadline.deadlineMs),
                    onTimeout: () => {
                        reportCallPhase();
                        runDeadlineTimeout({
                            failureCode: callDeadline.failureCode,
                            markTimedOut: () => { timeoutFailureCode = callDeadline.failureCode; timedOut = true; },
                            block: code => {
                                try {
                                    deps.repository.block(run.rootActionId, code);
                                }
                                catch {
                                    storageFailed = true;
                                    failedRoots.add(run.rootActionId);
                                }
                            },
                            abort: () => controller.abort(),
                        });
                    },
                });
                callWatchdog.start();
                reportCallPhase();
                const cancelled = new Promise<never>((_resolve, reject) => { const abort = () => reject(new Error('GENERATION_CANCELLED')); controller.signal.addEventListener('abort', abort, { once: true }); removeAbortListener = () => controller.signal.removeEventListener('abort', abort); });
                const provider = deps.dispatch(request.providerRequest, { signal: controller.signal, onDiagnostics: value => {
                        if (terminal || storageFailed || controller.signal.aborted) return;
                        diagnostics = { ...value };
                        diagnosticsAt = performance.now();
                        notify();
                    }, onReasoning: chunk => {
                        if (terminal || storageFailed || controller.signal.aborted || !chunk) return;
                        try { deps.onReasoning?.({ runId: run.runId, rootActionId: run.rootActionId, attemptId, text: chunk }); }
                        catch { /* A display-only event cannot alter durable generation. */ }
                    }, onVisible: event => {
                        if (terminal || storageFailed || controller.signal.aborted)
                            return;
                        if (event.eventId) {
                            const prior = events.get(event.eventId), current = JSON.stringify(event);
                            if (prior) {
                                if (prior !== current) {
                                    streamFailed = true;
                                    controller.abort();
                                }
                                return;
                            }
                            events.set(event.eventId, current);
                        }
                        if (/<\/?think\b/iu.test(event.text)) {
                            streamFailed = true;
                            controller.abort();
                            return;
                        }
                        const previous = request.agentToolNames ? agentProtocolText : text;
                        const next = event.kind === 'cumulative' ? event.text : previous + event.text;
                        if (!next.startsWith(previous) || /<\/?think\b/iu.test(next)) {
                            streamFailed = true;
                            controller.abort();
                            return;
                        }
                        if (request.agentToolNames) {
                            // Protocol may arrive as XML, DSML or raw JSON. Do not stream it
                            // through the user-artifact channel before its role is known.
                            agentProtocolText = next;
                            if (Buffer.byteLength(next, 'utf8') > 8 * 1024 * 1024) { streamFailed = true; controller.abort(); }
                            return;
                        }
                        text = next;
                        notify();
                        if (Buffer.byteLength(text) - Buffer.byteLength(durable) >= 4096)
                            flush();
                    } });
                const result = await Promise.race([provider, cancelled]);
                if (controller.signal.aborted)
                    throw new Error('GENERATION_CANCELLED');
                let usage = streamFailed ? null : settleProviderUsage(result.usage, policy);
                if (request.agentToolNames && result.finishReason === 'stop' && !streamFailed) {
                    const parsed = parseAgentResponseProtocol(agentProtocolText, request.agentToolNames);
                    text = parsed.visibleText;
                    if (parsed.toolCalls.length > 64) throw new Error('GENERATION_AGENT_ACTION_LIMIT');
                    usage = { ...usage!, agentResponse: { version: 1, visibleText: parsed.visibleText, toolCalls: parsed.toolCalls } };
                }
                else retainInterruptedAgentText();
                flush();
                receipt = deps.repository.settle(attemptId, usage, storageFailed ? 'error' : result.finishReason, undefined, diagnostics);
            }
            catch (error) {
                if (diagnostics) {
                    // 超时归属必须压过 provider 在 abort 路径上先写下的 endReason='cancelled'
                    // （openai-provider.ts:477-481 → notify :184-189），否则 failureCode 永不落、UI 分档是死分支。
                    if (timedOut) diagnostics = { ...diagnostics, endReason: 'failed',
                        ...(timeoutFailureCode ? { failureCode: timeoutFailureCode } : {}) };
                    else if (!diagnostics.endReason) diagnostics = { ...diagnostics, ...safeTransportError(error),
                        elapsedMs: diagnostics.elapsedMs + Math.max(0, Math.round(performance.now() - diagnosticsAt)),
                        endReason: controller.signal.aborted ? 'cancelled' : 'failed' };
                }
                retainInterruptedAgentText();
                flush();
                if (!timedOut && callWatchdog) {
                    callWatchdog.fail();
                    reportCallPhase();
                }
                try {
                    if (suspended) return { ...receipt, ...(storageFailed ? { unsavedTail: text.slice(durable.length) } : {}), failureCode: 'GENERATION_PROJECT_CLOSED' };
                    const current = deps.repository.receipt(attemptId);
                    if (current.attempt.status === 'dispatch-marked') {
                        // Persist only stable categories, never provider text that may contain credentials or prompts.
                        const networkCode = diagnostics?.causeCode ?? diagnostics?.errorCode;
                        const known = networkCode && /^(UND_ERR_|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ERR_STREAM_PREMATURE_CLOSE)/.test(networkCode)
                            || error instanceof Error && /^(NETWORK_ERROR|ECONNRESET|ETIMEDOUT|FETCH_FAILED)$/.test(error.message) ? 'NETWORK_ERROR' : 'GENERATION_PROVIDER_FAILED';
                        const failureCode = storageFailed ? 'GENERATION_STORAGE_FAILED' : timedOut ? (timeoutFailureCode ?? 'ROOT_BUDGET_EXHAUSTED')
                            : streamFailed ? 'GENERATION_STREAM_INVALID' : controller.signal.aborted ? 'GENERATION_CANCELLED' : known;
                        receipt = deps.repository.settle(attemptId, null, null, failureCode, diagnostics);
                    }
                    else
                        receipt = current;
                }
                catch {
                    storageFailed = true;
                    failedRoots.add(run.rootActionId);
                }
            }
            finally {
                terminal = true;
                if (timer)
                    clearInterval(timer);
                if (callWatchdog)
                    callWatchdog.dispose();
                removeAbortListener();
                controllers.delete(attemptId);
            }
            if (storageFailed)
                return { ...receipt, unsavedTail: text.slice(durable.length), failureCode: 'GENERATION_STORAGE_FAILED' };
            const finalReceipt = deps.repository.receipt(attemptId);
            if (controller.signal.aborted)
                return { ...finalReceipt, failureCode: finalReceipt.failureCode ?? (timedOut ? (timeoutFailureCode ?? 'ROOT_BUDGET_EXHAUSTED') : 'GENERATION_CANCELLED') };
            return finalReceipt;
        })();
        pending.set(key, operation);
        try {
            return await operation;
        }
        finally {
            pending.delete(key);
        }
    };
    return {
        open: (request: OpenGenerationRunRequest) => deps.repository.open(request), execute,
        suspendForProjectClose: () => {
            // Flush synchronously while the captured DB is still open, then
            // persist unknown accounting before its owner closes the handle.
            for (const item of controllers.values()) item.flush();
            let failure: unknown;
            try { deps.repository.recoverInterrupted(); } catch (error) { failure = error; }
            for (const item of controllers.values()) {
                try { item.suspend(); } catch (error) { failure ??= error; item.controller.abort(); }
            }
            if (unsavedTails.size) throw new Error('GENERATION_UNSAVED_TAIL_PRESENT');
            if (failure) throw failure;
        },
        readUnsavedTails: (): readonly GenerationUnsavedTail[] => Object.freeze([...unsavedTails.values()]),
        get: (runId: string) => deps.repository.get(runId),
        readAttempt: (attemptId: string) => deps.repository.receipt(attemptId),
        listCandidates: () => deps.repository.listCandidates(),
        discardCandidate: (id: string) => {
            deps.repository.discardCandidate(id);
            for (const [attemptId, tail] of unsavedTails) if (tail.artifactId === id) unsavedTails.delete(attemptId);
        },
        pause: (rootId: string) => { deps.repository.pause(rootId); for (const item of controllers.values())
            if (item.rootId === rootId)
                item.controller.abort(); },
        cancel: (rootId: string) => { deps.repository.pause(rootId, true); for (const item of controllers.values())
            if (item.rootId === rootId)
                item.controller.abort(); },
        resume: async (runId: string, next: RunBinding) => { const old = deps.repository.get(runId); if (!isDeepStrictEqual(old.binding.fingerprint, next.fingerprint) || old.binding.contextSnapshotId !== next.contextSnapshotId || !isDeepStrictEqual(old.binding.sourceManifest, next.sourceManifest) || !deps.validateRecovery || !await deps.validateRecovery(old.binding, next))
            throw new Error('GENERATION_RECOVERY_UNAUTHORIZED'); deps.repository.resume(runId, next); return deps.repository.get(runId); },
        restart: (oldRootId: string, request: OpenGenerationRunRequest) => { deps.repository.pause(oldRootId, true); for (const item of controllers.values())
            if (item.rootId === oldRootId)
                item.controller.abort(); return deps.repository.open(request); },
        recoverInterrupted: () => deps.repository.recoverInterrupted(),
    };
}
