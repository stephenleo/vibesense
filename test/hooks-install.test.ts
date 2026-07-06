import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installHooks } from '../src/hooks-install.js'

let dir: string
let settingsPath: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibesense-hooks-'))
  settingsPath = path.join(dir, 'settings.json')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function read(): Record<string, unknown> & {
  hooks: Record<string, Array<{ matcher?: string; hooks: Array<{ command: string }> }>>
} {
  return JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
}

describe('installHooks', () => {
  it('creates settings.json with all vibesense hook events', () => {
    installHooks(settingsPath)
    const settings = read()
    for (const event of [
      'UserPromptSubmit',
      'Stop',
      'Notification',
      'PreToolUse',
      'PostToolUse',
      'SessionEnd',
    ]) {
      expect(settings.hooks[event], event).toHaveLength(1)
      expect(settings.hooks[event]![0]!.hooks[0]!.command).toContain(`/hook/${event}`)
    }
    expect(settings.hooks.PreToolUse![0]!.matcher).toBe('AskUserQuestion')
  })

  it('is idempotent — running twice yields an identical file', () => {
    installHooks(settingsPath)
    const first = fs.readFileSync(settingsPath, 'utf8')
    installHooks(settingsPath)
    expect(fs.readFileSync(settingsPath, 'utf8')).toBe(first)
  })

  it('preserves foreign settings and foreign hooks', () => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        model: 'opus',
        hooks: {
          Stop: [{ matcher: '', hooks: [{ type: 'command', command: '/my/other/hook.sh' }] }],
        },
      }),
    )
    installHooks(settingsPath)
    const settings = read()
    expect(settings.model).toBe('opus')
    const stopCommands = settings.hooks.Stop!.flatMap((g) => g.hooks.map((h) => h.command))
    expect(stopCommands).toContain('/my/other/hook.sh')
    expect(stopCommands.some((c) => c.includes('/hook/Stop'))).toBe(true)
  })

  it('replaces stale vibesense entries instead of accumulating them', () => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        hooks: {
          Stop: [
            { hooks: [{ type: 'command', command: 'curl http://127.0.0.1:9999/hook/Stop-old' }] },
          ],
        },
      }),
    )
    installHooks(settingsPath)
    installHooks(settingsPath)
    expect(read().hooks.Stop).toHaveLength(1)
  })

  it('leaves an unparseable settings.json untouched', () => {
    fs.writeFileSync(settingsPath, '{not json')
    installHooks(settingsPath)
    expect(fs.readFileSync(settingsPath, 'utf8')).toBe('{not json')
  })
})
