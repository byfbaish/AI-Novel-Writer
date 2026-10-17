import { installMainGenerationTransport } from './services/generation/generation-runtime'
import { mainGenerationTransport } from './services/generation/main-generation-transport'
import { installPromptTraceFromDebugStore } from './services/prompts/install-prompt-trace'
import { configureMemoryProbe, installMemoryProbeConsoleHandle } from './services/debug/memory-probe'
import { useDebugStore } from './stores/debug-store'
import React from 'react'
import ReactDOM from 'react-dom/client'
import RendererStartup from './components/startup/RendererStartup'
import './index.css'


installMainGenerationTransport(mainGenerationTransport)
installPromptTraceFromDebugStore()
// 内存打点：关闭时 markMemory 首行短路，零开销；开关在 设置 → 开发者。
configureMemoryProbe({ enabled: () => useDebugStore.getState().memoryProbeEnabled })
installMemoryProbeConsoleHandle()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RendererStartup />
  </React.StrictMode>,
)
