// src/webview/achievement-burst/index.tsx
// Webview bundle entry point for the AchievementBurst overlay (Story 9.5)

import React from 'react'
import { createRoot } from 'react-dom/client'
import { AchievementBurst } from './AchievementBurst'

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<AchievementBurst />)
}
