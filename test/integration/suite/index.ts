// test/integration/suite/index.ts
// Integration test suite runner for @vscode/test-electron
// Discovers and runs all *.test.ts files under test/integration/suite/

import * as path from 'path'
import Mocha from 'mocha'
import { glob } from 'glob'

export async function run(): Promise<void> {
  // Create the mocha test runner
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 10000,
  })

  const testsRoot = path.resolve(__dirname)
  const files = await glob('**/*.test.js', { cwd: testsRoot })

  // Add test files to the mocha instance
  files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)))

  return new Promise<void>((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} test(s) failed.`))
      } else {
        resolve()
      }
    })
  })
}
