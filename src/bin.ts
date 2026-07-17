#!/usr/bin/env node
// Entry wrapper: npm 12+ blocks dependency install scripts by default, which
// silently skips node-pty / node-hid native builds — the CLI then dies at
// import time. npm runs no package code during install (by design), so the
// earliest we can catch it is first run: turn the module-load error into the
// exact reinstall command instead of a stack trace.
try {
  await import('./cli.js')
} catch (err) {
  const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
  if (/node-pty|node-hid|native module|\.node['")\s]/.test(detail)) {
    console.error(
      'vibesense: native modules failed to load — npm likely blocked their install scripts (default since npm 12).\n' +
        'Fix with:\n\n' +
        '  npm install -g @vibesense/cli --allow-scripts=@vibesense/cli,node-pty,node-hid\n',
    )
    process.exit(1)
  }
  throw err
}
