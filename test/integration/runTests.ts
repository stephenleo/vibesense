// test/integration/runTests.ts
// Entry script for @vscode/test-electron integration test runner
// Run via: node ./out/test/integration/runTests.js

import * as path from 'path'
import { runTests } from '@vscode/test-electron'

async function main(): Promise<void> {
  // The folder containing the extension's package.json
  const extensionDevelopmentPath = path.resolve(__dirname, '../../..')

  // The path to the compiled test suite index
  const extensionTestsPath = path.resolve(__dirname, '../suite/index')

  await runTests({ extensionDevelopmentPath, extensionTestsPath })
}

main().catch((err) => {
  console.error('Failed to run integration tests', err)
  process.exit(1)
})
