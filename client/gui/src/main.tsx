import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app.tsx'
import { initI18n } from '@/i18n'
import { readConfig } from '@/api/system/config'

/**
 * Resolve the saved language before the first paint so the UI never flashes
 * English. A missing/unreadable config (first run, corrupt file, non-Electron
 * context) falls back to the OS language rather than failing the boot.
 */
async function bootstrap(): Promise<void> {
  const config = await readConfig().catch(() => null)
  await initI18n(config?.language)

  createRoot(document.getElementById('root')!).render(
    // <StrictMode>
    <App />
    // </StrictMode>,
  )
}

void bootstrap()
