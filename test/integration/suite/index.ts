// test/integration/suite/index.ts
// Integration test suite runner for @vscode/test-electron
// Discovers and runs all *.test.js files under test/integration/suite/

import * as path from 'path'
import * as fs from 'fs'
import Mocha from 'mocha'

export async function run(): Promise<void> {
  // Create the mocha test runner
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 10000,
  })

  const testsRoot = path.resolve(__dirname)

  // Discover test files using fs (avoids external glob dependency)
  const files = fs.readdirSync(testsRoot).filter((f) => f.endsWith('.test.js'))

  // Add test files to the mocha instance
  files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)))

  return new Promise<void>((resolve, reject) => {
    mocha.run((failures: number) => {
      if (failures > 0) {
        reject(new Error(`${failures} test(s) failed.`))
      } else {
        resolve()
      }
    })
  })
}
