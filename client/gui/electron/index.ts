import { app, BrowserWindow, shell, ipcMain, dialog, session, Menu, screen, net } from 'electron'
import { join, dirname, normalize } from 'path'
import { homedir } from 'os'
import { appendFileSync, createReadStream, createWriteStream, readFileSync, writeFileSync, existsSync, statSync, unlinkSync } from 'fs'
import type { WriteStream } from 'fs'
import { constants as bufferConstants } from 'buffer'
import { contentSecurityPolicy } from './csp'

// Appearance
// app.commandLine.appendSwitch('enable-gpu-rasterization')
// app.commandLine.appendSwitch('enable-zero-copy')
// app.commandLine.appendSwitch('disable-renderer-backgrounding')
// app.commandLine.appendSwitch('disable-background-timer-throttling')
// app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
// app.commandLine.appendSwitch('ignore-gpu-blocklist')

// Performance
app.commandLine.appendSwitch('disable-background-networking')
app.commandLine.appendSwitch('disable-domain-reliability')
app.commandLine.appendSwitch('disable-component-update')
app.commandLine.appendSwitch('disable-default-apps')
app.commandLine.appendSwitch('disable-extensions')
app.commandLine.appendSwitch(
  'disable-features',
  [
    'AutofillServerCommunication',
    'CalculateNativeWinOcclusion',
    'InterestFeedContentSuggestions',
    'MediaSessionService',
    'HardwareMediaKeyHandling',
    'Translate',
    'CertificateTransparencyComponentUpdater',
  ].join(','),
)
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-gpu-memory-buffer-video-frames')

// Chromium logs ERROR for uncached X11 atoms used by xdg-desktop-portal DnD (harmless).
const LINUX_APP_ID = 'com.nukerat.app'

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('log-level', '3')
  app.setDesktopName(LINUX_APP_ID)
}

function linuxDesktopIntegrated(): boolean {
  return existsSync(join(homedir(), '.local/share/applications', `${LINUX_APP_ID}.desktop`))
}

app.commandLine.appendSwitch('ignore-certificate-errors')
app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
  event.preventDefault()
  callback(true)
})

function iconAssetDirs(): string[] {
  return [join(app.getAppPath(), 'public'), join(__dirname, '../renderer')]
}

function firstExistingIconPath(candidates: string[]): string | undefined {
  for (const dir of iconAssetDirs()) {
    for (const name of candidates) {
      const filePath = join(dir, name)
      if (existsSync(filePath)) return filePath
    }
  }
  return undefined
}

function resolveWindowIcon(): string | undefined {
  if (process.platform === 'win32' && app.isPackaged) return undefined

  if (process.platform === 'win32') {
    return firstExistingIconPath(['icon.ico', 'icon_256x256.png'])
  }

  if (process.platform === 'linux' && linuxDesktopIntegrated()) {
    return undefined
  }

  return firstExistingIconPath(['icon_256x256.png', 'icon_128x128.png', 'favicon.png'])
}

function setupContentSecurityPolicy(): void {
  const policy = contentSecurityPolicy(!app.isPackaged)

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    })
  })
}

function disableNativeAppMenu(win: BrowserWindow): void {
  win.removeMenu()
  win.setMenuBarVisibility(false)
}

function createWindow(): void {
  const windowIconPath = resolveWindowIcon()
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  const width = Math.min(Math.max(Math.round(wa.width * 0.75), 900), wa.width)
  const height = Math.min(Math.max(Math.round(wa.height * 0.75), 600), wa.height)
  const mainWindow = new BrowserWindow({
    width,
    height,
    x: Math.round(wa.x + (wa.width - width) / 2),
    y: Math.round(wa.y + (wa.height - height) / 2),
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(windowIconPath ? { icon: windowIconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  })

  // ============== Close guard: prompt confirmation when active sessions exist
  let hasWindows = false

  ipcMain.on('app:setHasWindows', (_e, value: boolean) => { hasWindows = value })

  mainWindow.on('close', (e) => {
    if (!hasWindows) return
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['Quit', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Confirm exit',
      message: 'There are active sessions. Are you sure you want to quit?',
    })
    if (choice !== 0) e.preventDefault()
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // ============== Security: block external URLs from opening inside the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ============== Config: read and write config.json from the app directory
let cachedAppDataDir: string | undefined

function packagedPortableDir(): string {
  if (process.platform === 'linux' && process.env.APPIMAGE) {
    return dirname(process.env.APPIMAGE)
  }
  return dirname(process.execPath)
}

/** Dev/preview: project folder. Packaged: beside .exe / AppImage, or userData if config only exists there. */
function appDataDir(): string {
  if (!app.isPackaged) return app.getAppPath()
  if (cachedAppDataDir) return cachedAppDataDir

  const portable = packagedPortableDir()
  const userData = app.getPath('userData')
  if (existsSync(join(portable, 'config.json'))) cachedAppDataDir = portable
  else if (existsSync(join(userData, 'config.json'))) cachedAppDataDir = userData
  else cachedAppDataDir = portable

  return cachedAppDataDir
}

const emptyConfigJson = JSON.stringify({ servers: [] }, null, 2)
const emptyDownloadsJson = JSON.stringify({ entries: [] }, null, 2)

function ensureConfigFile(): string {
  const cfgPath = configPath()
  if (!existsSync(cfgPath)) {
    writeFileSync(cfgPath, emptyConfigJson)
    if (app.isPackaged) cachedAppDataDir = dirname(cfgPath)
  }
  return cfgPath
}

function ensureDownloadsFile(): string {
  const p = downloadsPath()
  if (!existsSync(p)) writeFileSync(p, emptyDownloadsJson)
  return p
}

function configPath(): string {
  return join(appDataDir(), 'config.json')
}

function readConfig(): object {
  const p = ensureConfigFile()
  return JSON.parse(readFileSync(p, 'utf-8'))
}

ipcMain.handle('config:read', () => readConfig())
ipcMain.handle('config:write', (_e, data: object) => {
  writeFileSync(configPath(), JSON.stringify(data, null, 2))
})

// ============== Downloads registry (downloads.json)
function downloadsPath(): string {
  return join(appDataDir(), 'downloads.json')
}

function readDownloadsRegistry(): { entries: unknown[] } {
  const p = ensureDownloadsFile()
  try {
    const raw = JSON.parse(readFileSync(p, 'utf-8')) as { entries?: unknown[] }
    if (!raw || !Array.isArray(raw.entries)) return { entries: [] }
    return { entries: raw.entries }
  } catch {
    return { entries: [] }
  }
}

function purgeRequestingDownloads(): void {
  const data = readDownloadsRegistry()
  const kept = data.entries.filter((e) => (e as { phase?: string })?.phase !== 'requesting')
  if (kept.length === data.entries.length) return
  writeFileSync(downloadsPath(), JSON.stringify({ entries: kept }, null, 2))
}

ipcMain.handle('downloads:read', () => readDownloadsRegistry())
ipcMain.handle('downloads:write', (_e, data: { entries: unknown[] }) => {
  writeFileSync(downloadsPath(), JSON.stringify({ entries: data.entries ?? [] }, null, 2))
})

ipcMain.handle('app:getAboutInfo', () => {
  const proc = process as NodeJS.Process & { electronBuildId?: string }
  const electronBuildId = proc.electronBuildId
  return {
    version: app.getVersion(),
    electron: process.versions.electron ?? '',
    chromium: process.versions.chrome ?? '',
    node: process.versions.node ?? '',
    platform: `${process.platform} (${process.arch})`,
    ...(electronBuildId ? { electronBuildId } : {}),
  }
})

function readLocalFileBytes(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('File path is required')
  }

  if (!existsSync(filePath)) {
    throw new Error('File not found')
  }

  try {
    const fileStat = statSync(filePath)
    if (!fileStat.isFile()) {
      throw new Error('Path is not a file')
    }
    const maxRawBytes = Math.floor((bufferConstants.MAX_STRING_LENGTH - 1024) * 3 / 4)
    if (fileStat.size > maxRawBytes) {
      const maxMiB = Math.floor(maxRawBytes / (1024 * 1024))
      throw new Error(`File is too large (max ${maxMiB} MB)`)
    }

    const data = readFileSync(filePath)
    if (!data.length) {
      throw new Error('File is empty')
    }

    return data.toString('base64')
  } catch (error) {
    if (error instanceof Error && (
      error.message === 'Path is not a file' ||
      error.message === 'File is empty' ||
      error.message.startsWith('File is too large')
    )) {
      throw error
    }

    const code = (error as NodeJS.ErrnoException).code
    switch (code) {
      case 'EACCES':
      case 'EPERM':
        throw new Error('Permission denied')
      case 'EBUSY':
      case 'ETXTBSY':
        throw new Error('File is in use')
      case 'EISDIR':
        throw new Error('Path is a directory')
      case 'ENOTDIR':
        throw new Error('Invalid file path')
      case 'ENOENT':
        throw new Error('File not found')
      case 'EMFILE':
      case 'ENFILE':
        throw new Error('Too many open files')
      case 'EFBIG':
        throw new Error('File is too large')
      default:
        throw new Error('Failed to read file')
    }
  }
}

ipcMain.handle('file:readBytes', (_e, filePath: string) => {
  try {
    return readLocalFileBytes(filePath)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read file'
    return { error: `${message}\n` }
  }
})

ipcMain.handle(
  'file:streamPost',
  async (_e, payload: { url: string; filePath: string; headers: Record<string, string> }) => {
    try {
      if (!payload?.filePath || !existsSync(payload.filePath)) return { error: 'File not found\n' }
      const fileStat = statSync(payload.filePath)
      if (!fileStat.isFile()) return { error: 'Path is not a file\n' }
      if (!fileStat.size) return { error: 'File is empty\n' }
      const request = net.request({
        method: 'POST',
        url: payload.url,
        headers: payload.headers,
      })
      request.chunkedEncoding = true
      const file = createReadStream(payload.filePath)
      let ended = false
      return await new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        request.on('response', (response) => {
          response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
          response.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8')
            resolve({
              ok: (response.statusCode ?? 0) >= 200 && (response.statusCode ?? 0) < 300,
              status: response.statusCode ?? 0,
              text,
            })
          })
          response.on('error', reject)
        })
        request.on('error', reject)
        file.on('error', (error) => {
          request.abort()
          reject(error)
        })
        file.on('data', (chunk) => {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          file.pause()
          request.write(buf, undefined, () => {
            if (!ended) file.resume()
          })
        })
        file.on('end', () => {
          ended = true
          request.end()
        })
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read file'
      return { error: `${message}\n` }
    }
  },
)

function writeLocalFileBytes(filePath: string, base64: string): void {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('File path is required')
  }

  const parentDir = dirname(filePath)
  if (!existsSync(parentDir)) {
    throw new Error('Directory not found')
  }

  try {
    if (!statSync(parentDir).isDirectory()) {
      throw new Error('Invalid file path')
    }
    writeFileSync(filePath, Buffer.from(base64, 'base64'))
  } catch (error) {
    if (error instanceof Error && (
      error.message === 'File path is required' ||
      error.message === 'Directory not found' ||
      error.message === 'Invalid file path'
    )) {
      throw error
    }

    const code = (error as NodeJS.ErrnoException).code
    switch (code) {
      case 'EACCES':
      case 'EPERM':
        throw new Error('Permission denied')
      case 'EBUSY':
      case 'ETXTBSY':
        throw new Error('File is in use')
      case 'EISDIR':
        throw new Error('Path is a directory')
      case 'ENOTDIR':
        throw new Error('Invalid file path')
      case 'ENOENT':
        throw new Error('Directory not found')
      case 'EMFILE':
      case 'ENFILE':
        throw new Error('Too many open files')
      default:
        throw new Error('Failed to save file')
    }
  }
}

// ======= download =======

/** One open write stream per path; Uint8Array over IPC (structured clone), async disk writes. */
const downloadStreams = new Map<string, WriteStream>()

function writeStreamChunk(stream: WriteStream, data: Uint8Array): Promise<void> {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  return new Promise((resolve, reject) => {
    stream.write(buf, (err) => (err ? reject(err) : resolve()))
  })
}

ipcMain.handle('file:downloadOpen', (_event, outputPath: string) => {
  if (!outputPath) throw new Error('File path is required')
  const existing = downloadStreams.get(outputPath)
  if (existing) {
    existing.destroy()
    downloadStreams.delete(outputPath)
  }
  downloadStreams.set(outputPath, createWriteStream(outputPath, { flags: 'w' }))
  return true
})

ipcMain.handle('file:downloadWrite', async (_event, payload: { outputPath: string; data: Uint8Array }) => {
  const stream = downloadStreams.get(payload.outputPath)
  if (!stream) throw new Error('Download stream not open')
  await writeStreamChunk(stream, payload.data)
  return true
})

ipcMain.handle('file:downloadClose', async (_event, outputPath: string) => {
  const stream = downloadStreams.get(outputPath)
  if (!stream) return false
  downloadStreams.delete(outputPath)
  return new Promise<boolean>((resolve, reject) => {
    stream.end((err: any) => (err ? reject(err) : resolve(true)))
  })
})

ipcMain.handle('file:listActiveDownloads', () => Array.from(downloadStreams.keys()))

ipcMain.handle('file:showItemInFolder', async (_event, filePath: string) => {
  const fullPath = normalize(String(filePath ?? '').trim())
  if (!fullPath) return false

  let folder = dirname(fullPath)
  try {
    if (existsSync(fullPath)) {
      folder = statSync(fullPath).isDirectory() ? fullPath : dirname(fullPath)
    }
  } catch {
    return false
  }

  // Linux: showItemInFolder often does nothing without a working XDG portal; openPath is reliable.
  if (process.platform === 'linux' || process.platform === 'freebsd') {
    if (!existsSync(folder)) return false
    const err = await shell.openPath(folder)
    return err === ''
  }

  if (existsSync(fullPath) && statSync(fullPath).isFile()) {
    shell.showItemInFolder(fullPath)
    return true
  }
  if (existsSync(folder)) {
    const err = await shell.openPath(folder)
    return err === ''
  }
  return false
})

ipcMain.handle('file:deletePath', (_event, filePath: string) => {
  if (!filePath) return false
  try {
    if (existsSync(filePath)) unlinkSync(filePath)
    return true
  } catch {
    return false
  }
})

ipcMain.handle(
  'window:setDownloadProgress',
  (event, payload: { progress?: number; mode?: 'normal' | 'indeterminate' }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    if (payload?.mode === 'indeterminate') {
      win.setProgressBar(2, { mode: 'indeterminate' })
      return true
    }
    const p = payload?.progress
    if (typeof p !== 'number' || p < 0 || p > 1) {
      win.setProgressBar(-1)
    } else {
      win.setProgressBar(p)
    }
    return true
  },
)

ipcMain.handle('file:pickSavePath', async (event, payload: { defaultName?: string }) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const { canceled, filePath } = win
    ? await dialog.showSaveDialog(win, { defaultPath: payload.defaultName || 'download' })
    : await dialog.showSaveDialog({ defaultPath: payload.defaultName || 'download' })
  return canceled || !filePath ? null : filePath
})

// ========================

ipcMain.handle('file:saveBytes', async (event, payload: { defaultName?: string; base64: string; outputPath?: string; append?: boolean }) => {
  if (payload.outputPath) {
    if (payload.append) {
      appendFileSync(payload.outputPath, Buffer.from(payload.base64, 'base64'))
    } else {
      writeLocalFileBytes(payload.outputPath, payload.base64)
    }
    return true
  }

  const win = BrowserWindow.fromWebContents(event.sender)
  const { canceled, filePath } = win
    ? await dialog.showSaveDialog(win, { defaultPath: payload.defaultName || 'download' })
    : await dialog.showSaveDialog({ defaultPath: payload.defaultName || 'download' })
  if (canceled || !filePath) return false
  writeLocalFileBytes(filePath, payload.base64)
  return true
})

// ============== Window controls (from renderer menu)
const ZOOM_STEP = 0.5
const ZOOM_MIN = -9
const ZOOM_MAX = 9

ipcMain.on('window:minimize', (e) => {
  BrowserWindow.fromWebContents(e.sender)?.minimize()
})

ipcMain.on('window:maximize', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
})

ipcMain.on('window:zoomIn', (e) => {
  const wc = e.sender
  wc.setZoomLevel(Math.min(wc.getZoomLevel() + ZOOM_STEP, ZOOM_MAX))
})

ipcMain.on('window:zoomOut', (e) => {
  const wc = e.sender
  wc.setZoomLevel(Math.max(wc.getZoomLevel() - ZOOM_STEP, ZOOM_MIN))
})

ipcMain.on('window:resetZoom', (e) => {
  const wc = e.sender
  wc.setZoomFactor(1)
  wc.setZoomLevel(0)
})

ipcMain.on('window:reload', (e) => {
  e.sender.reload()
})

ipcMain.on('window:toggleDevTools', (e) => {
  e.sender.toggleDevTools()
})

ipcMain.on('window:toggleFullscreen', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return
  win.setFullScreen(!win.isFullScreen())
})

// ============== Lifecycle: initialize app and handle macOS reactivation 
app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  setupContentSecurityPolicy()

  app.on('browser-window-created', (_event, win) => {
    disableNativeAppMenu(win)
  })

  ensureConfigFile()
  ensureDownloadsFile()
  purgeRequestingDownloads()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
