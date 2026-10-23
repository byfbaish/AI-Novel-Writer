import { ipcMain, BrowserWindow } from 'electron'
import {
  readJsonFile,
  tryReadJsonFile,
  writeJsonFile,
  MODELS_CONFIG_PATH,
  GLOBAL_CONFIG_PATH,
  DEFAULT_GLOBAL_CONFIG,
} from '../utils/config-utils'
import type { GlobalConfig, LLMFinishReason, LLMRequest, ModelDiscoveryRequest, ModelProfile, TokenUsage } from '../../src/shared/ipc-channels'
import { isProjectSessionContext } from '../../src/shared/project-session-context'
import { isReasoningMapping } from '../../src/shared/reasoning-types'
import { LLMFactory } from '../llm/llm-factory'
import { resolveGenerationParameters } from '../llm/generation-parameter-policy'
import { getCurrentProjectPath } from '../database'
import { LLMHistoryRepository } from '../repositories/llm-repository'
import { projectAccess } from '../services/project-access'
import {
  ModelExecutionLeaseError,
  ModelExecutionLeaseRegistry,
} from '../services/model-execution-lease'
import { ModelDiscoveryService } from '../services/model-discovery-service'
import { probeLlmRequest, probeLlmResponse } from '../services/llm-probe'

interface ActiveStream {
  controller: AbortController
  recordCancelled: () => void
}

const activeStreams = new Map<string, ActiveStream>()
const CONNECTION_TEST_MAX_TOKENS = 1024
const CLOSED_EXECUTION_LEASE_TOMBSTONE_TTL_MS = 5 * 60_000

function loadModelConfigs(): ModelProfile[] {
  return readJsonFile<ModelProfile[]>(MODELS_CONFIG_PATH, [])
}

function loadModelConfigsForUpdate(): ModelProfile[] {
  const result = tryReadJsonFile<ModelProfile[]>(MODELS_CONFIG_PATH)
  if (result.status === 'error') {
    throw new Error('模型配置损坏，已拒绝覆盖', { cause: result.error })
  }
  return result.status === 'ok' ? result.value : []
}

function loadGlobalConfigForUpdate(): GlobalConfig {
  const result = tryReadJsonFile<GlobalConfig>(GLOBAL_CONFIG_PATH)
  if (result.status === 'error') {
    throw new Error('全局配置损坏，已拒绝覆盖', { cause: result.error })
  }
  return result.status === 'ok' ? result.value : { ...DEFAULT_GLOBAL_CONFIG }
}

function saveModelConfigs(models: ModelProfile[]) {
  writeJsonFile(MODELS_CONFIG_PATH, models)
}

function getModelConfig(modelId: string): ModelProfile | null {
  const models = loadModelConfigs()
  return models.find((m) => m.id === modelId) ?? null
}

function applyProxyConfig() {
  try {
    const config = readJsonFile<GlobalConfig>(GLOBAL_CONFIG_PATH, DEFAULT_GLOBAL_CONFIG)
    if (config.proxy?.enabled && config.proxy.host) {
      const proxyUrl = config.proxy.type === 'socks5'
        ? `socks5://${config.proxy.host}:${config.proxy.port}`
        : `http://${config.proxy.host}:${config.proxy.port}`
      process.env.HTTP_PROXY = proxyUrl
      process.env.HTTPS_PROXY = proxyUrl
      process.env.http_proxy = proxyUrl
      process.env.https_proxy = proxyUrl
    } else {
      delete process.env.HTTP_PROXY
      delete process.env.HTTPS_PROXY
      delete process.env.http_proxy
      delete process.env.https_proxy
    }
  } catch { /* 忽略 */ }
}

/** 诊断串长度上限：够看清状态码与首行说明，又不至于把整段响应体写进库。 */
const MAX_CALL_FAILURE_CHARS = 300

/**
 * 一次失败调用的诊断串：`finish:<reason>` 与真实错误**并存**。
 *
 * - 只有结束原因（旧行为）⇒ 知道"怎么结束的"，不知道"为什么"；
 * - 只有错误 ⇒ 分不清是模型主动停（`length`）还是请求被拒（`error`）。
 *
 * 成功调用仍返回 `undefined`（不制造噪声）。
 */
export function describeCallFailure(outcome: {
  success: boolean
  error?: string
  finishReason?: LLMFinishReason
}): string | undefined {
  const finish = outcome.finishReason && outcome.finishReason !== 'stop'
    ? `finish:${outcome.finishReason}`
    : ''
  const detail = outcome.error?.trim().slice(0, MAX_CALL_FAILURE_CHARS) ?? ''
  if (!finish) return detail || undefined
  if (!detail) return finish
  // 错误文案常自带 "Error: ..."，拼起来会像两条独立结论，用分隔符明确这是一条记录的两个字段。
  return `${finish} | ${detail}`
}

function recordProviderOutcome(
  request: LLMRequest,
  model: ModelProfile,
  startedAt: number,
  outcome: {
    success: boolean
    usage?: TokenUsage
    error?: string
    finishReason?: LLMFinishReason
  },
): void {
  if (!isProjectSessionContext(request.projectSession)) return
  try {
    projectAccess.assertCurrentProjectContext(request.projectSession, getCurrentProjectPath())
    LLMHistoryRepository.logCall({
      modelId: model.id,
      modelName: model.name || model.modelName,
      purpose: request.purpose?.trim() || 'generation',
      promptTokens: outcome.usage?.promptTokens ?? null,
      completionTokens: outcome.usage?.completionTokens ?? null,
      totalTokens: outcome.usage?.totalTokens ?? null,
      durationMs: Math.max(0, Date.now() - startedAt),
      success: outcome.success,
      /**
       * 诊断串要**同时留**结束原因与真实错误。
       *
       * 原来这里是三元：`finishReason !== 'stop'` 时只写 `finish:<reason>`，把
       * `outcome.error` 整个丢掉 —— 2026-10-23 排查资源提案连失 5 次时，库里只剩
       * `finish:error`，真实原因（provider 回的是 `API 调用失败 (400): …`）无从得知。
       * 结束原因说明"怎么结束的"，错误说明"为什么"，两者缺一都得回到现场重跑。
       */
      errorMessage: describeCallFailure(outcome),
    })
  } catch (error) {
    // Statistics are diagnostic only and must never change generation outcome.
    console.warn('[AI Novel Writer] LLM call statistics were not recorded.', error)
  }
}

export function registerLLMController() {
  const modelExecutionLeases = new ModelExecutionLeaseRegistry({ loadModel: getModelConfig })
  const modelDiscovery = new ModelDiscoveryService()
  const closedExecutionLeaseTombstones = new Map<string, number>()

  const pruneClosedExecutionLeaseTombstones = (now: number) => {
    for (const [leaseId, expiresAt] of closedExecutionLeaseTombstones) {
      if (expiresAt <= now) closedExecutionLeaseTombstones.delete(leaseId)
    }
  }

  ipcMain.handle('llm:begin-execution-lease', async (_event, modelId: string) => {
    try {
      return { success: true, lease: modelExecutionLeases.begin(modelId) }
    } catch (error) {
      if (error instanceof ModelExecutionLeaseError && error.code === 'MODEL_NOT_FOUND') {
        return {
          success: false,
          errorCode: 'MODEL_NOT_FOUND' as const,
          error: '指定的生成模型不存在或已被删除。',
        }
      }
      return {
        success: false,
        errorCode: 'LEASE_BEGIN_FAILED' as const,
        error: '无法创建模型执行租约。',
      }
    }
  })

  ipcMain.handle('llm:close-execution-lease', async (_event, leaseId: string) => {
    const now = Date.now()
    pruneClosedExecutionLeaseTombstones(now)
    if (modelExecutionLeases.close(leaseId)) {
      closedExecutionLeaseTombstones.set(
        leaseId,
        now + CLOSED_EXECUTION_LEASE_TOMBSTONE_TTL_MS,
      )
      return { success: true }
    }
    if (closedExecutionLeaseTombstones.has(leaseId)) return { success: true }
    return { success: false, error: '模型执行租约无效或已关闭' }
  })

  ipcMain.handle('llm:generate', async (_event, request: LLMRequest) => {
    const startedAt = Date.now()
    const probe = probeLlmRequest(request, 'invoke')
    let model: ModelProfile | null = null
    try {
      applyProxyConfig()
      model = request.modelExecutionLeaseId
        ? modelExecutionLeases.resolve(request.modelExecutionLeaseId)
        : getModelConfig(request.modelId)
      if (!model) {
        probeLlmResponse(probe, { error: '未找到模型配置' })
        return { success: false, content: '', finishReason: 'error', error: '未找到模型配置' }
      }

      const provider = LLMFactory.getProvider(model)
      const result = await provider.generate(
        model,
        request.messages,
        {
          ...resolveGenerationParameters(model, request),
          // One execution lease spans one logical generation run; its id is the
          // gateway conversation scope so retries keep session affinity.
          conversationId: request.modelExecutionLeaseId,
        },
      )
      recordProviderOutcome(request, model, startedAt, result)
      probeLlmResponse(probe, {
        content: result.content,
        finishReason: result.finishReason,
        usage: result.usage,
        error: result.error,
      })
      return result
    } catch (error) {
      if (model) recordProviderOutcome(request, model, startedAt, { success: false, error: String(error) })
      probeLlmResponse(probe, { error: String(error) })
      return { success: false, content: '', finishReason: 'error', error: String(error) }
    }
  })

  ipcMain.handle('llm:generate-stream', async (event, requestId: string, request: LLMRequest) => {
    applyProxyConfig()
    const probe = probeLlmRequest(request, 'stream')
    let model: ModelProfile | null
    try {
      model = request.modelExecutionLeaseId
        ? modelExecutionLeases.resolve(request.modelExecutionLeaseId)
        : getModelConfig(request.modelId)
    } catch (error) {
      probeLlmResponse(probe, { error: String(error) })
      return { requestId, started: false, error: String(error) }
    }
    if (!model) {
      probeLlmResponse(probe, { error: '未找到模型配置' })
      return { requestId, started: false }
    }
    const generationParameters = {
      ...resolveGenerationParameters(model, request),
      // Same scope as llm:generate: the execution lease, when present, marks
      // one logical generation run for gateway session affinity.
      conversationId: request.modelExecutionLeaseId,
    }

    const abortController = new AbortController()
    const startedAt = Date.now()
    let recorded = false
    const recordOnce = (outcome: {
      success: boolean
      usage?: TokenUsage
      error?: string
      content?: string
      finishReason?: LLMFinishReason
    }) => {
      if (recorded) return
      recorded = true
      // 只把统计仓库认识的字段交给它：`content` 属于探针，`finishReason` 只在
      // 正常终止（onDone）时出现 —— 传进 onError 会把真实错误文本覆盖成
      // `finish:error`，那是语义退化。
      recordProviderOutcome(request, model, startedAt, outcome.finishReason === undefined
        ? { success: outcome.success, usage: outcome.usage, error: outcome.error }
        : { success: outcome.success, usage: outcome.usage, error: outcome.error, finishReason: outcome.finishReason })
      probeLlmResponse(probe, outcome)
    }
    activeStreams.set(requestId, {
      controller: abortController,
      recordCancelled: () => recordOnce({ success: false, error: 'cancelled' }),
    })
    const win = BrowserWindow.fromWebContents(event.sender)

    const provider = LLMFactory.getProvider(model)
    
    // We do not await this globally since it's streaming independently
    provider.generateStream(model, request.messages, {
      ...generationParameters,
      signal: abortController.signal,
      onChunk: (chunk: string) => win?.webContents.send('llm:stream-chunk', { requestId, chunk }),
      onDone: (fullText: string, usage?: TokenUsage, finishReason?: LLMFinishReason) => {
        const terminalReason: LLMFinishReason = finishReason ?? 'unknown'
        const success = terminalReason === 'stop'
        recordOnce({
          success,
          usage,
          content: fullText,
          finishReason: terminalReason,
          error: success ? undefined : `finish:${terminalReason}`,
        })
        win?.webContents.send('llm:stream-done', {
          requestId,
          fullText,
          usage,
          finishReason: terminalReason,
        })
        activeStreams.delete(requestId)
      },
      onError: (error: string, content?: string, usage?: TokenUsage) => {
        recordOnce({ success: false, usage, error, content })
        if (content !== undefined) {
          win?.webContents.send('llm:stream-done', {
            requestId,
            fullText: content,
            usage,
            finishReason: 'error',
          })
        } else {
          win?.webContents.send('llm:stream-error', { requestId, error })
        }
        activeStreams.delete(requestId)
      },
    })

    return { requestId, started: true }
  })

  ipcMain.handle('llm:cancel', async (_event, requestId: string) => {
    const stream = activeStreams.get(requestId)
    if (stream) {
      stream.recordCancelled()
      stream.controller.abort()
      activeStreams.delete(requestId)
      return { success: true }
    }
    return { success: false }
  })

  ipcMain.handle('llm:list-models', async () => loadModelConfigs())

  ipcMain.handle('llm:discover-models', async (_event, request: ModelDiscoveryRequest) => {
    try {
      applyProxyConfig()
      return await modelDiscovery.discoverModels(request)
    } catch {
      return { success: false, errorCode: 'invalid_response' as const }
    }
  })

  ipcMain.handle('llm:save-model', async (_event, model: ModelProfile) => {
    try {
      if (model.reasoningMapping !== undefined && (!isReasoningMapping(model.reasoningMapping)
        || (model.protocol === 'gemini') !== (model.reasoningMapping.adapter === 'gemini-thinking-budget'))) {
        throw new Error('INVALID_REASONING_MAPPING')
      }
      const models = loadModelConfigsForUpdate()
      const idx = models.findIndex((m) => m.id === model.id)
      if (idx >= 0) models[idx] = model
      else models.push(model)
      saveModelConfigs(models)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('llm:delete-model', async (_event, modelId: string) => {
    let originalConfig: GlobalConfig | undefined
    let configChanged = false
    try {
      const modelsRead = tryReadJsonFile<ModelProfile[]>(MODELS_CONFIG_PATH)
      if (modelsRead.status === 'error') throw modelsRead.error
      const originalModels = modelsRead.status === 'ok' ? modelsRead.value : []
      const configRead = tryReadJsonFile<GlobalConfig>(GLOBAL_CONFIG_PATH)
      if (configRead.status === 'error') throw configRead.error
      originalConfig = configRead.status === 'ok'
        ? configRead.value
        : { ...DEFAULT_GLOBAL_CONFIG }

      const nextConfig = { ...originalConfig }
      if (nextConfig.defaultModelId === modelId) {
        nextConfig.defaultModelId = null
        configChanged = true
      }
      if (nextConfig.defaultEmbeddingModelId === modelId) {
        nextConfig.defaultEmbeddingModelId = null
        configChanged = true
      }

      // 先清除引用，再删除被引用对象。若第二个文件写入失败，回滚配置；
      // 即使回滚也失败，配置中只会缺少默认值，不会悬空指向已删除模型。
      if (configChanged) writeJsonFile(GLOBAL_CONFIG_PATH, nextConfig)
      try {
        saveModelConfigs(originalModels.filter(model => model.id !== modelId))
      } catch (error) {
        if (configChanged) {
          try {
            writeJsonFile(GLOBAL_CONFIG_PATH, originalConfig)
          } catch (rollbackError) {
            throw new Error(`${String(error)}；恢复默认模型配置失败：${String(rollbackError)}`)
          }
        }
        throw error
      }
      return {
        success: true,
        defaultModelId: nextConfig.defaultModelId,
        defaultEmbeddingModelId: nextConfig.defaultEmbeddingModelId ?? null,
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('llm:set-default-model', async (_event, modelId: string | null) => {
    try {
      const config = loadGlobalConfigForUpdate()
      config.defaultModelId = modelId
      writeJsonFile(GLOBAL_CONFIG_PATH, config)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('llm:get-default-model', async () => {
    const config = readJsonFile<GlobalConfig>(GLOBAL_CONFIG_PATH, DEFAULT_GLOBAL_CONFIG)
    return config.defaultModelId
  })

  ipcMain.handle('llm:set-default-embedding-model', async (_event, modelId: string | null) => {
    try {
      const config = loadGlobalConfigForUpdate()
      config.defaultEmbeddingModelId = modelId
      writeJsonFile(GLOBAL_CONFIG_PATH, config)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('llm:get-default-embedding-model', async () => {
    const config = readJsonFile<GlobalConfig>(GLOBAL_CONFIG_PATH, DEFAULT_GLOBAL_CONFIG)
    return config.defaultEmbeddingModelId ?? null
  })

  ipcMain.handle('llm:test-connection', async (
    _event,
    model: ModelProfile,
    creativeStrategy: LLMRequest['creativeStrategy'] = 'auto',
  ) => {
    try {
      applyProxyConfig()
      
      const messages = [{ role: 'user', content: 'Say "hello" and nothing else.' }]
      const provider = LLMFactory.getProvider(model)
      
      let result = { success: true, error: undefined as undefined | string }
      if (model.purposes?.includes('embedding')) {
        const { generateEmbeddings } = await import('../embedding')
        await generateEmbeddings(['hello'], model.protocol, model)
      } else {
        const res = await provider.generate(
          model,
          messages,
          resolveGenerationParameters(model, {
            // 推理模型可能先消耗 reasoning tokens；预算过小会把可用连接误判为截断失败。
            maxTokens: CONNECTION_TEST_MAX_TOKENS,
            reasoningStage: 'general',
            creativeStrategy,
          }),
        )
        result = { success: res.success, error: res.error }
      }
      
      return { success: result.success, error: result.error }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  return { modelExecutionLeases, loadModel: getModelConfig, applyProxyConfig }
}
