import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installCodexHooks, installHooks } from '../src/hooks-install.js'

let dir: string
let settingsPath: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibesense-hooks-'))
  settingsPath = path.join(dir, 'settings.json')
})

afterEach(() => {
  delete process.env.CODEX_HOME
  fs.rmSync(dir, { recursive: true, force: true })
})

function read(): Record<string, unknown> & {
  hooks: Record<string, Array<{ matcher?: string; hooks: Array<{ command: string }> }>>
} {
  return JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
}

describe('installHooks', () => {
  it('creates settings.json with all vibesense hook events', () => {
    expect(installHooks(settingsPath)).toBe('changed')
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

  it('keeps the established Claude hook command bytes unchanged', () => {
    installHooks(settingsPath)
    expect(read().hooks.Stop![0]!.hooks[0]!.command).toBe(
      "curl -s --max-time 1 -X POST http://127.0.0.1:48753/hook/Stop -H 'Content-Type: application/json' -d @- >/dev/null 2>&1 || true",
    )
  })

  it('is idempotent — running twice yields an identical file', () => {
    installHooks(settingsPath)
    const first = fs.readFileSync(settingsPath, 'utf8')
    expect(installHooks(settingsPath)).toBe('unchanged')
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

describe('installCodexHooks', () => {
  it('creates exactly the four Codex lifecycle hooks with safe command output', () => {
    expect(installCodexHooks(settingsPath)).toBe('changed')
    const settings = read()
    expect(Object.keys(settings.hooks).sort()).toEqual(
      ['PermissionRequest', 'PostToolUse', 'Stop', 'UserPromptSubmit'].sort(),
    )
    for (const [event, groups] of Object.entries(settings.hooks)) {
      expect(groups).toHaveLength(1)
      expect(groups[0]!.matcher, event).toBeUndefined()
      const command = groups[0]!.hooks[0]!.command
      expect(command).toContain(`/hook/${event}`)
      expect(command).toContain('X-Vibesense-Instance-Id: $VIBESENSE_INSTANCE_ID')
      expect(command).toContain("printf '{}'")
    }
  })

  it('is byte-idempotent and reports unchanged on the second install', () => {
    expect(installCodexHooks(settingsPath)).toBe('changed')
    const first = fs.readFileSync(settingsPath, 'utf8')
    expect(installCodexHooks(settingsPath)).toBe('unchanged')
    expect(fs.readFileSync(settingsPath, 'utf8')).toBe(first)
  })

  it('uses CODEX_HOME and preserves foreign data and hooks', () => {
    process.env.CODEX_HOME = dir
    settingsPath = path.join(dir, 'hooks.json')
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        custom: true,
        hooks: { Stop: [{ hooks: [{ type: 'command', command: '/other/stop-hook' }] }] },
      }),
    )
    expect(installCodexHooks()).toBe('changed')
    const settings = read()
    expect(settings.custom).toBe(true)
    expect(settings.hooks.Stop).toHaveLength(2)
  })

  it('replaces stale Vibesense entries but keeps arbitrary webhook commands', () => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        hooks: {
          Stop: [
            {
              hooks: [
                {
                  type: 'command',
                  command: 'curl http://127.0.0.1:48753/hook/Stop >/dev/null',
                },
              ],
            },
            { hooks: [{ type: 'command', command: 'curl https://example.com/hook/Stop' }] },
          ],
          Notification: [
            {
              hooks: [
                {
                  type: 'command',
                  command:
                    'curl http://127.0.0.1:48753/hook/Notification -H "X-Vibesense-Instance-Id: $VIBESENSE_INSTANCE_ID"',
                },
              ],
            },
            null,
            { futureExtension: true },
          ],
        },
      }),
    )
    installCodexHooks(settingsPath)
    const settings = read()
    expect(settings.hooks.Stop).toHaveLength(2)
    expect(settings.hooks.Stop![0]!.hooks[0]!.command).toBe('curl https://example.com/hook/Stop')
    expect(settings.hooks.Notification).toEqual([null, { futureExtension: true }])
  })

  it('leaves invalid JSON untouched and reports failure', () => {
    fs.writeFileSync(settingsPath, '{broken')
    expect(installCodexHooks(settingsPath)).toBe('failed')
    expect(fs.readFileSync(settingsPath, 'utf8')).toBe('{broken')
  })
})
