// src/extension/stats/achievement-definitions.ts
// Achievement catalog — all achievements with id, label, tier, and description (Story 9.5)
// Extension-host-only — do NOT import from webview code.

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface AchievementDefinition {
  id: string
  label: string
  tier: AchievementTier
  description: string
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'first-steps',
    label: 'First Steps',
    tier: 'bronze',
    description: 'Complete your first controller-only session',
  },
  {
    id: 'streak-3',
    label: 'On a Roll',
    tier: 'bronze',
    description: 'Maintain a 3-day usage streak',
  },
  {
    id: 'streak-7',
    label: 'Week Warrior',
    tier: 'silver',
    description: 'Maintain a 7-day usage streak',
  },
  {
    id: 'level-2',
    label: 'Level Up',
    tier: 'bronze',
    description: 'Reach Level 2',
  },
  {
    id: 'level-5',
    label: 'Veteran Vibe Coder',
    tier: 'gold',
    description: 'Reach Level 5',
  },
  {
    id: 'sessions-10',
    label: 'Getting Serious',
    tier: 'silver',
    description: 'Complete 10 controller-only sessions',
  },
]
