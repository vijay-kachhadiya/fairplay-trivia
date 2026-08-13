// Design tokens.
//
// Light, professional, data-forward. One brand color (indigo), near-black ink
// for primary actions, restrained green and red for status, soft shadows on
// white cards over a light gray canvas. The palette is lifted from a finance
// dashboard reference so the demo reads like a studio designed it, not like a
// developer picked defaults.

import { Platform } from 'react-native';

export const theme = {
  // Canvas and surfaces
  bg: '#F4F5F7',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F8FA',
  card: '#FFFFFF',
  cardRaised: '#FFFFFF',

  // Hairlines
  border: '#E9EBF0',
  borderStrong: '#DFE2E9',

  // Text
  text: '#1B1F2A', // ink, headings and primary copy
  textDim: '#8A909C', // secondary
  textFaint: '#AEB4BF', // tertiary, hints

  // Primary action (the near-black pill, like the dashboard's main button)
  primary: '#16181F',
  primaryText: '#FFFFFF',

  // Brand accent (the indigo of the chart line)
  accent: '#4F5BD5',
  accentText: '#4F5BD5',
  accentSoft: '#EEF0FB',

  // Semantic
  good: '#1FA971',
  goodSoft: '#E7F6EF',
  bad: '#E5484D',
  badSoft: '#FDECEC',
  gold: '#E1A33B',
  goldSoft: '#FBF2E3',

  // Code surface (kept dark on purpose, reads as an intentional snippet)
  codeBg: '#1B1F2A',
  codeText: '#E6E9F2',
  codeAccent: '#9BA6F5',

  radius: 16,
  radiusSm: 12,
  radiusPill: 999
};

// Soft elevation for white cards. iOS uses shadow*, Android uses elevation;
// React Native ignores the keys that do not apply to the current platform.
export const shadow = Platform.select({
  ios: {
    shadowColor: '#101828',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }
  },
  android: { elevation: 2 },
  default: {}
}) as object;

// A lighter shadow for smaller, interactive elements.
export const shadowSm = Platform.select({
  ios: {
    shadowColor: '#101828',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }
  },
  android: { elevation: 1 },
  default: {}
}) as object;
