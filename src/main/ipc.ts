import fs from 'node:fs'
import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import { Channel, ERROR_MARKER, type CodedErrorWire, type MainRequestName, type MainRequests } from '@shared/protocol'
import type { EngineSupervisor } from './engine-supervisor'
import type { Vault } from './vault'
import { settings, remoteSettingsIn, remoteSettingsOut } from './settings'
import { dataDir, missingVault } from './paths'
import { hostPage } from './widgets'
import { readImage } from './assets'
import { clearAll, readHeader, writeBackup } from './backup'
import { addVault, chooseVault, createVault, listVaults, removeVault, renameVault, restoreVault } from './vaults'
import { UNCODED, errorCode } from '@shared/errors'
import type { Gateway } from './network/gateway'
import type { Problems } from './problems'
import { cleanProblemReport } from '@shared/problems'
import { suggestPassword } from './network/password'

export function coded(err: unknown, request?: string): CodedErrorWire {
  return { [ERROR_MARKER]: { code: errorCode(err) ?? UNCODED, message: err instanceof Error ? err.message : String(err), ...(request ? { request } : {}) } }
}

type MainHandlers = {
  [K in MainRequestName]: (
    win: BrowserWindow | null,
    params: MainRequests[K]['params']
  ) => MainRequests[K]['result'] | Promise<MainRequests[K]['result']>
}

export interface IpcContext {
  engine: EngineSupervisor
  vault: Vault
  gateway: Gateway
  problems: Problems
  showApp: (sessionId: string | null) => void
  quit: () => void
}

async function pick(win: BrowserWindow | null, options: Electron.OpenDialogOptions): Promise<string | null> {
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  return result.canceled ? null : (result.filePaths[0] ?? null)
}

async function askSavePath(win: BrowserWindow | null, name: string, filters?: Electron.FileFilter[]): Promise<string | null> {
  const options = { defaultPath: name.replace(/[<>:"/\\|?*]+/g, '_'), ...(filters ? { filters } : {}) }
  const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  return result.canceled || !result.filePath ? null : result.filePath
}

export interface MainDispatch {
  call: (name: MainRequestName, params: unknown) => Promise<unknown>
}

export function registerIpc(ctx: IpcContext): MainDispatch {
  const handlers: MainHandlers = {
    'vault.status': () => ctx.vault.check(),
    'vault.setup': (_win, { passphrase }) => ctx.vault.setup(passphrase),
    'vault.unlock': (_win, { passphrase }) => ctx.vault.unlock(passphrase),
    'vault.lock': () => ctx.vault.lock(),
    'window.minimize': (win) => {
      win?.minimize()
    },
    'window.toggleMaximize': (win) => {
      if (!win) return false
      if (win.isMaximized()) win.unmaximize()
      else win.maximize()
      return win.isMaximized()
    },
    'window.close': (win) => {
      win?.close()
    },
    'window.isMaximized': (win) => win?.isMaximized() ?? false,
    'dialog.openFolder': (win) => pick(win, { properties: ['openDirectory'] }),
    'dialog.openFile': (win, { filters }) => pick(win, { properties: ['openFile'], filters }),
    'assets.readImage': (_win, { id }) => readImage(id),
    'dialog.openModelFile': (win) =>
      pick(win, { properties: ['openFile'], filters: [{ name: 'Model files', extensions: ['gguf', 'safetensors', 'sft', 'ckpt'] }] }),
    'dialog.openFiles': async (win) => {
      const result = win
        ? await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'] })
        : await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
      return result.canceled ? [] : result.filePaths
    },
    'present.page': async (_win, { html }) => {
      if (typeof html !== 'string' || html.length > 200 * 1024) throw new Error('That page is too big')
      return hostPage(html)
    },
    'folder.open': async (_win, { path: target }) => {
      const error = await shell.openPath(target)
      if (error) throw new Error(error)
    },
    'dialog.saveText': async (win, { name, text }) => {
      const target = await askSavePath(win, name)
      if (target) await fs.promises.writeFile(target, text, 'utf8')
      return target
    },
    'dialog.savePath': (win, { name }) => askSavePath(win, name),
    'conversions.saveBackup': async (win, { ids, name }) => {
      const target = await askSavePath(win, name, [{ name: 'Zip backup', extensions: ['zip'] }])
      if (!target) return null
      const res = (await ctx.engine.request('conversions.backup', { ids, target })) as { files: number; bytes: number }
      return { path: target, ...res }
    },
    'asset.saveAs': async (win, { id, name }) => {
      const source = ctx.vault.openableCopy((await ctx.engine.request('data.assets.path', { id })) as string)
      const target = await askSavePath(win, name)
      if (target) await fs.promises.copyFile(source, target)
      return target
    },
    'clipboard.write': async (_win, { text }) => clipboard.writeText(text),
    'asset.open': async (_win, { id, reveal }) => {
      const file = ctx.vault.openableCopy((await ctx.engine.request('data.assets.path', { id })) as string)
      if (reveal) shell.showItemInFolder(file)
      else {
        const error = await shell.openPath(file)
        if (error) throw new Error(error)
      }
    },
    'settings.get': (win) => (win ? settings.get() : remoteSettingsOut(settings.get())),
    'settings.set': (win, patch) => settings.set(win ? patch : remoteSettingsIn(patch)),
    'app.info': () => ({ version: app.getVersion(), dataDir, platform: process.platform, vaultMissing: missingVault }),
    'app.show': (_win, { sessionId }) => ctx.showApp(sessionId),
    'app.quit': () => ctx.quit(),
    'data.backup': async (win) => {
      const target = await askSavePath(win, `seven-backup-${new Date().toISOString().slice(0, 10)}.sevenbackup`, [{ name: 'Seven backup', extensions: ['sevenbackup'] }])
      return target ? { path: target, ...(await writeBackup(target)) } : null
    },
    'data.pickBackup': async (win) => {
      const file = await pick(win, { properties: ['openFile'], filters: [{ name: 'Seven backup', extensions: ['sevenbackup'] }] })
      if (!file) return null
      const header = await readHeader(file)
      return { path: file, createdAt: header.createdAt, encrypted: header.encrypted }
    },
    'vaults.list': () => listVaults(),
    'vaults.create': (_win, { name, path }) => createVault(name, path),
    'vaults.add': (_win, { name, path }) => addVault(name, path),
    'vaults.rename': (_win, { path, name }) => renameVault(path, name),
    'vaults.remove': (_win, { path }) => removeVault(path),
    'vaults.restore': (_win, { source, name, path }) => restoreVault(source, name, path),
    'vaults.switch': async (_win, { path }) => {
      chooseVault(path)
      ctx.engine.stop()
      await new Promise((resolve) => setTimeout(resolve, 1000))
      app.relaunch()
      ctx.quit()
    },
    'data.clearAll': async (_win, { keepSettings }) => {
      ctx.engine.stop()
      await new Promise((resolve) => setTimeout(resolve, 1000))
      try {
        clearAll(keepSettings)
      } finally {
        app.relaunch()
        app.quit()
      }
    },
    'engine.status': () => ctx.engine.status(),
    'problems.list': () => ctx.problems.list(),
    'problems.report': (_win, report) => void ctx.problems.add(cleanProblemReport(report)),
    'problems.dismiss': (_win, { id }) => ctx.problems.dismiss(id),
    'problems.clear': () => ctx.problems.clear(),
    'network.status': () => ctx.gateway.status(),
    'network.set': (_win, { on, settings }) => ctx.gateway.set(on, settings),
    'network.password.suggest': () => suggestPassword(),
    'network.password.set': (_win, { password }) => ctx.gateway.setPassword(password),
    'network.certificate.get': () => ctx.gateway.certificate(),
    'network.certificate.renew': () => ctx.gateway.renewCertificate(),
    'network.unlock': (_win, { address }) => ctx.gateway.unlock(address),
    'network.pair.start': () => ctx.gateway.pairStart(),
    'network.pair.cancel': () => ctx.gateway.pairCancel(),
    'network.pair.allow': (_win, { requestId }) => ctx.gateway.pairAllow(requestId),
    'network.pair.deny': (_win, { requestId }) => ctx.gateway.pairDeny(requestId),
    'network.revoke': (_win, { deviceId }) => ctx.gateway.revoke(deviceId),
    'network.unpairAll': () => ctx.gateway.unpairAll(),
    'network.deviceLevel': (_win, { deviceId, level }) => ctx.gateway.setDeviceLevel(deviceId, level)
  }

  ipcMain.handle(Channel.engine, (_event, name: string, params) => {
    if (name === 'vault.setKey' || name === 'vault.migrate') return coded(new Error(`${name} is not available to windows`), name)
    return ctx.engine.request(name as Parameters<EngineSupervisor['request']>[0], params).catch((err: unknown) => coded(err, name))
  })

  ipcMain.handle(Channel.main, (event, name: MainRequestName, params) => {
    const handler = handlers[name] as ((win: BrowserWindow | null, p: unknown) => unknown) | undefined
    if (!handler) return coded(new Error(`Unknown request: ${name}`), name)
    return Promise.resolve()
      .then(() => handler(BrowserWindow.fromWebContents(event.sender), params))
      .catch((err: unknown) => coded(err, name))
  })

  return {
    call: (name, params) => {
      const handler = handlers[name] as ((win: BrowserWindow | null, p: unknown) => unknown) | undefined
      if (!handler) return Promise.reject(new Error(`Unknown request: ${name}`))
      return Promise.resolve().then(() => handler(null, params))
    }
  }
}
