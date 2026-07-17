import { Platform } from 'react-native';
import { BREAKPOINT_TABLET, width } from '../constants/layout';
import { BOARD_PADDING, TAB_RATIO } from '../constants/puzzle';

export function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

export function distance(touches) {
  if (!touches || touches.length < 2) return 0;
  const [a, b] = touches;
  return Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY);
}

export function center(touches) {
  if (!touches || touches.length < 2) return { x: 0, y: 0 };
  const [a, b] = touches;
  return { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 };
}

export function pieceSize(piece) {
  const cols = piece?.cols || 4;
  const maxSize = width > BREAKPOINT_TABLET ? 72 : Platform.OS === 'android' ? 48 : 54;
  const availableWidth = width - 92;

  return Math.min(maxSize, availableWidth / cols);
}

export function overhang(size) {
  return size * TAB_RATIO;
}

export function visualSize(size) {
  return size + overhang(size) * 2;
}

// Yüksek parça sayılarında (örn. 1024 parça) parçalar zoom yapılmadan
// dokunma için çok küçük kalabiliyor (~9-13px). Erişilebilirlik standart
// minimum dokunma hedefine (44px) tamamlayacak kadar hitSlop döndürür —
// görsel boyutu değiştirmez, sadece dokunma alanını genişletir.
const MIN_TOUCH_TARGET = 44;

export function minTouchHitSlop(widthPx, heightPx = widthPx) {
  const extraX = Math.max(0, (MIN_TOUCH_TARGET - widthPx) / 2);
  const extraY = Math.max(0, (MIN_TOUCH_TARGET - heightPx) / 2);
  return { top: extraY, bottom: extraY, left: extraX, right: extraX };
}

export function frameOrigin(piece, layout) {
  if (!piece) return { x: BOARD_PADDING, y: BOARD_PADDING };

  const size = pieceSize(piece);
  const frameWidth = size * piece.cols;

  const boardHeight = layout?.height || 600;
const frameHeight = size * piece.rows;

return {
  x: Math.max(BOARD_PADDING, ((layout?.width || width) - frameWidth) / 2),
  y: Math.max(BOARD_PADDING, Math.min(56, (boardHeight - frameHeight) * 0.18)),
};
}

export function solvedPosition(piece, origin) {
  const size = pieceSize(piece);
  const oh = overhang(size);

  return {
    x: origin.x + piece.col * size - oh,
    y: origin.y + piece.row * size - oh,
  };
}

export function inverse(e) {
  if (e === 'out') return 'in';
  if (e === 'in') return 'out';
  return 'flat';
}

// Eski (row+col) checkerboard yöntemi: hem dikey hem yatay kenar aynı
// (row+col)%2 değerinden türetildiği için bir parçanın DÖRT kenarı da
// zorunlu olarak aynı yöne (ya hepsi dışa, ya hepsi içe) çıkıyordu — gerçek
// bir yapbozda her kenar birbirinden bağımsız olmalı. Sadece bu alanı
// içermeyen ESKİ kayıtlı puzzle'lar için geriye dönük uyumluluk amacıyla
// tutuluyor; yeni üretilen parçalarda buildEdgeGrid kullanılıyor.
function legacyVerticalEdge(row, col) {
  return (row + col) % 2 === 0 ? 'out' : 'in';
}

function legacyHorizontalEdge(row, col) {
  return (row + col) % 2 === 0 ? 'out' : 'in';
}

function legacyEdgesOf(piece) {
  return {
    top:
      piece.row === 0
        ? 'flat'
        : inverse(legacyHorizontalEdge(piece.row - 1, piece.col)),
    right:
      piece.col === piece.cols - 1
        ? 'flat'
        : legacyVerticalEdge(piece.row, piece.col),
    bottom:
      piece.row === piece.rows - 1
        ? 'flat'
        : legacyHorizontalEdge(piece.row, piece.col),
    left:
      piece.col === 0
        ? 'flat'
        : inverse(legacyVerticalEdge(piece.row, piece.col - 1)),
  };
}

// Her paylaşılan kenar (iki komşu parça arasındaki sınır) için bağımsız bir
// yön ata: bir parçanın üst/alt/sağ/sol kenarları birbirinden habersiz,
// gerçek bir yapbozdaki gibi karışık (bazısı dışa çıkıntı, bazısı içe
// girinti) olabiliyor. Paylaşılan kenarın iki tarafı her zaman ters yönde
// (biri 'out', komşusu 'in') tutuluyor ki parçalar birbirine tam otursun.
function buildEdgeGrid(rows, cols) {
  const edges = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      top: 'flat',
      right: 'flat',
      bottom: 'flat',
      left: 'flat',
    }))
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c < cols - 1) {
        const dir = Math.random() < 0.5 ? 'out' : 'in';
        edges[r][c].right = dir;
        edges[r][c + 1].left = inverse(dir);
      }

      if (r < rows - 1) {
        const dir = Math.random() < 0.5 ? 'out' : 'in';
        edges[r][c].bottom = dir;
        edges[r + 1][c].top = inverse(dir);
      }
    }
  }

  return edges;
}

export function createPieces(uri, totalPieces) {
  const grid = Math.round(Math.sqrt(totalPieces));
  const stamp = Date.now();
  const edgeGrid = buildEdgeGrid(grid, grid);

  return Array.from({ length: grid * grid }, (_, i) => {
    const row = Math.floor(i / grid);
    const col = i % grid;

    return {
      id: `${stamp}-${i}`,
      originalIndex: i,
      uri,
      row,
      col,
      rows: grid,
      cols: grid,
      isEdge: row === 0 || col === 0 || row === grid - 1 || col === grid - 1,
      edges: edgeGrid[row][col],
    };
  });
}

export function edgesOf(piece) {
  return piece.edges || legacyEdgesOf(piece);
}

// Klasik yapboz eklemi: Draradech'in yaygın kullanılan, kanıtlanmış jigsaw SVG
// üretici formülünden uyarlandı (https://gist.github.com/Draradech/35d36347312ca6d0887aa7d55f366e30).
// Kenar boyunca parametrik konum (s: 0→1) ve dikey derinlik oranında (w, dir
// ile çarpılır) 9 nokta: düz kenardan ayrılırken önce hafifçe İÇE kıvrılıp
// (w=-t, "kavis"), sonra dar bir BOYUNA (w=t) çıkıp, oradan çok daha derin
// yuvarlak bir BAŞA (w=3t) şişkinleşiyor — üç kübik bezier ile.
// Draradech'in referans sitesindeki varsayılan "Tab Size: %20" değeri
// (t = %20/2 = 0.1) birebir kullanılıyor. Derinlik 3*TAB_T'ye kadar çıktığı
// için (bkz. tabPoints) overhang(size)=size*TAB_RATIO bunu karşılayacak
// kadar büyük tutuluyor (constants/puzzle.js: TAB_RATIO=0.34).
const TAB_T = 0.1;

function tabPoints() {
  const t = TAB_T;
  return [
    { s: 0.2, w: 0 },
    { s: 0.5, w: -t },
    { s: 0.5 - t, w: t },
    { s: 0.5 - 2 * t, w: 3 * t },
    { s: 0.5 + 2 * t, w: 3 * t },
    { s: 0.5 + t, w: t },
    { s: 0.5, w: -t },
    { s: 0.8, w: 0 },
    { s: 1, w: 0 },
  ];
}

// mapPoint(s, w) → {x, y}; kenarın yönüne göre s (kenar boyunca) ve w
// (dir ile çarpılmış derinlik) eksenlerini gerçek piksel koordinatına çevirir.
function tabCurveCommands(mapPoint) {
  const p = tabPoints().map(({ s, w }) => mapPoint(s, w));

  return (
    ` C ${p[0].x} ${p[0].y}, ${p[1].x} ${p[1].y}, ${p[2].x} ${p[2].y}` +
    ` C ${p[3].x} ${p[3].y}, ${p[4].x} ${p[4].y}, ${p[5].x} ${p[5].y}` +
    ` C ${p[6].x} ${p[6].y}, ${p[7].x} ${p[7].y}, ${p[8].x} ${p[8].y}`
  );
}

export function jigsawPath(piece, size) {
  const oh = overhang(size);

  const x0 = oh;
  const y0 = oh;
  const x1 = oh + size;
  const y1 = oh + size;

  const e = edgesOf(piece);

  let d = `M ${x0} ${y0}`;

  if (e.top === 'flat') {
    d += ` L ${x1} ${y0}`;
  } else {
    const dir = e.top === 'out' ? -1 : 1;
    d += tabCurveCommands((s, w) => ({ x: x0 + s * size, y: y0 + dir * w * size }));
  }

  if (e.right === 'flat') {
    d += ` L ${x1} ${y1}`;
  } else {
    const dir = e.right === 'out' ? 1 : -1;
    d += tabCurveCommands((s, w) => ({ x: x1 + dir * w * size, y: y0 + s * size }));
  }

  if (e.bottom === 'flat') {
    d += ` L ${x0} ${y1}`;
  } else {
    const dir = e.bottom === 'out' ? 1 : -1;
    d += tabCurveCommands((s, w) => ({ x: x1 - s * size, y: y1 + dir * w * size }));
  }

  if (e.left === 'flat') {
    d += ` L ${x0} ${y0}`;
  } else {
    const dir = e.left === 'out' ? -1 : 1;
    d += tabCurveCommands((s, w) => ({ x: x0 + dir * w * size, y: y1 - s * size }));
  }

  return `${d} Z`;
}

export function adjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}
