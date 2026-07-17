export const STORAGE_KEY = 'PUZZLE_APP_SAVED_PUZZLES_V2';
export const SELECT_MODE_INDEX = 3;
export const SEND_COUNT = 20;
export const BOARD_PADDING = 16;
// Draradech jigsaw formülünün (bkz. puzzleGeometry.js TAB_T) varsayılan tab
// derinliği (3*0.1=%30) tuvalin dışına taşmasın diye 0.2'den büyütüldü.
export const TAB_RATIO = 0.34;
// Bir Unity yapboz referansına (dist < tile_boyutu*0.2) yakın, parçanın
// gerçekten yakınında olunca birleşmesi için küçültüldü — eskiden 0.85/0.42
// idi ve parçalar çok uzaktan bile birleşebiliyordu.
export const FRAME_SNAP = 0.38;
export const GROUP_SNAP = 0.22;
// Board yakınlaştırma seviyesinden bağımsız, ekran pikseli cinsinden sabit
// bir parmak-hassasiyeti payı (bkz. puzzleGroups.js). Çok küçük parçalarda
// (yüksek parça sayısı) mantıksal birim cinsinden sabit bir taban kullanmak
// parçanın kat kat üzerinde bir mesafeden birleşmeye sebep oluyordu.
export const MIN_SNAP_SCREEN_PX = 10;
// Hepsi tam kare (5²..32²) — createPieces'teki Math.round(Math.sqrt(n))
// hesabıyla kusursuz NxN grid üretir, yuvarlama hatası olmaz.
export const DIFFICULTIES = [25, 100, 225, 400, 625, 784, 900, 1024];

// Üst bar yüksekliği (PuzzleScreen.styles.js: gameTopBar.height) — tepsi tam
// açıldığında bunun hemen altında kalması için sheet yükseklik hesabında da
// kullanılıyor.
export const TOP_BAR_HEIGHT = 58;
// Tepsi tam açıkken üst bardan bırakılan boşluk.
export const SHEET_TOP_GAP = 12;
// Tepsi tamamen "kapalı" sayıldığında görünen minimum yükseklik — sadece
// tutamaç çubuğunu gösterip parçaları/başlığı gizleyecek kadar küçük.
export const SHEET_MIN_HEIGHT = 28;
// Tepsi grid'inin yatay iç boşluğu (PuzzleScreen.styles.js: pieceGrid.paddingHorizontal)
export const TRAY_GRID_H_PADDING = 18;
// Her tepsi parçasının etrafındaki boşluk (PuzzleScreen.styles.js: trayPiece.margin)
export const TRAY_ITEM_GAP = 6;

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
