import { installMainGenerationTransport } from './services/generation/generation-runtime'
import { mainGenerationTransport } from './services/generation/main-generation-transport'
import { installPromptTraceFromDebugStore } from './services/prompts/install-prompt-trace'
import React from 'react'
import ReactDOM from 'react-dom/client'
import RendererStartup from './components/startup/RendererStartup'
import './index.css'


installMainGenerationTransport(mainGenerationTransport)
installPromptTraceFromDebugStore()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RendererStartup />
  </React.StrictMode>,
)
