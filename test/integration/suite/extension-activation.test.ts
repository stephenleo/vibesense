// test/integration/suite/extension-activation.test.ts
// Proof-of-life integration test: verifies the VibeSense extension activates
// Runs inside the VSCode Extension Development Host via @vscode/test-electron

import * as assert from 'assert'
import * as vscode from 'vscode'

suite('Extension Activation', () => {
  test('VibeSense extension is registered', () => {
    const ext = vscode.extensions.getExtension('stephenleo.vibesense')
    assert.ok(ext, 'Extension stephenleo.vibesense should be registered')
  })

  test('VibeSense extension activates without error', async () => {
    const ext = vscode.extensions.getExtension('stephenleo.vibesense')
    if (ext && !ext.isActive) {
      await ext.activate()
    }
    assert.ok(ext?.isActive, 'Extension should be active after activation')
  })
})
