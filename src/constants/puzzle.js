export const STORAGE_KEY = 'PUZZLE_APP_SAVED_PUZZLES_V2';
export const SELECT_MODE_INDEX = 2;
export const SEND_COUNT = 20;
export const BOARD_PADDING = 16;
export const TAB_RATIO = 0.2;
export const FRAME_SNAP = 0.85;
export const GROUP_SNAP = 0.42;
export const DIFFICULTIES = [36, 64, 100, 144, 196, 256];

export const PRESETS = [
  {
    id: 'p1',
    label: 'Sarı Çiçekler',
    uri: 'https://images.unsplash.com/photo-1490750967868-88df5691cc8a?w=900',
  },
  {
    id: 'p2',
    label: 'Kiraz',
    uri: 'https://images.unsplash.com/photo-1528821128474-27f963b062bf?w=900',
  },
  {
    id: 'p3',
    label: 'Nar',
    uri: 'https://images.unsplash.com/photo-1541344999736-83eca272f6fc?w=900',
  },
];

export const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  id: `c-${i}`,
  left: `${6 + ((i * 17) % 88)}%`,
  size: 13 + (i % 5) * 4,
  rotate: i % 2 ? '-24deg' : '20deg',
  emoji: ['💜', '✨', '🎉', '⭐'][i % 4],
}));
