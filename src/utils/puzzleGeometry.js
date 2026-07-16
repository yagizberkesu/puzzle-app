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

export function jigsawPath(piece, size) {
  const oh = overhang(size);

  const x0 = oh;
  const y0 = oh;
  const x1 = oh + size;
  const y1 = oh + size;

  const midX = oh + size / 2;
  const midY = oh + size / 2;

  // Gerçek yapboz çıkıntıları tek düze bir tümsek değil, "omuz → dar boyun →
  // yuvarlak geniş baş → dar boyun → omuz" şeklinde bir S-kıvrımı çiziyor.
  // Basitçe iki genişlik değerini yer değiştirmek (önceki deneme) orantısız,
  // "ucube" görünen tek büyük bir şişkinlik yaratmıştı — üç ayrı genişlik
  // (omuz/boyun/baş) ve beş bezier segmentiyle kademeli, yumuşak bir geçiş
  // sağlanıyor.
  const shoulderHalf = size * 0.13; // düz kenarla birleşen omuz genişliği
  const neckHalf = size * 0.075; // boyunun en dar noktası
  const bulbHalf = size * 0.17; // yuvarlak başın en geniş noktası
  const depth = size * 0.2;

  const e = edgesOf(piece);

  let d = `M ${x0} ${y0}`;

  if (e.top === 'flat') {
    d += ` L ${x1} ${y0}`;
  } else {
    const dir = e.top === 'out' ? -1 : 1;
    d += ` L ${midX - shoulderHalf} ${y0}
      C ${midX - shoulderHalf} ${y0 + dir * depth * 0.12}, ${midX - neckHalf} ${y0 + dir * depth * 0.12}, ${midX - neckHalf} ${y0 + dir * depth * 0.32}
      C ${midX - neckHalf} ${y0 + dir * depth * 0.52}, ${midX - bulbHalf} ${y0 + dir * depth * 0.52}, ${midX - bulbHalf} ${y0 + dir * depth * 0.75}
      C ${midX - bulbHalf} ${y0 + dir * depth * 1.02}, ${midX + bulbHalf} ${y0 + dir * depth * 1.02}, ${midX + bulbHalf} ${y0 + dir * depth * 0.75}
      C ${midX + bulbHalf} ${y0 + dir * depth * 0.52}, ${midX + neckHalf} ${y0 + dir * depth * 0.52}, ${midX + neckHalf} ${y0 + dir * depth * 0.32}
      C ${midX + neckHalf} ${y0 + dir * depth * 0.12}, ${midX + shoulderHalf} ${y0 + dir * depth * 0.12}, ${midX + shoulderHalf} ${y0}
      L ${x1} ${y0}`;
  }

  if (e.right === 'flat') {
    d += ` L ${x1} ${y1}`;
  } else {
    const dir = e.right === 'out' ? 1 : -1;
    d += ` L ${x1} ${midY - shoulderHalf}
      C ${x1 + dir * depth * 0.12} ${midY - shoulderHalf}, ${x1 + dir * depth * 0.12} ${midY - neckHalf}, ${x1 + dir * depth * 0.32} ${midY - neckHalf}
      C ${x1 + dir * depth * 0.52} ${midY - neckHalf}, ${x1 + dir * depth * 0.52} ${midY - bulbHalf}, ${x1 + dir * depth * 0.75} ${midY - bulbHalf}
      C ${x1 + dir * depth * 1.02} ${midY - bulbHalf}, ${x1 + dir * depth * 1.02} ${midY + bulbHalf}, ${x1 + dir * depth * 0.75} ${midY + bulbHalf}
      C ${x1 + dir * depth * 0.52} ${midY + bulbHalf}, ${x1 + dir * depth * 0.52} ${midY + neckHalf}, ${x1 + dir * depth * 0.32} ${midY + neckHalf}
      C ${x1 + dir * depth * 0.12} ${midY + neckHalf}, ${x1 + dir * depth * 0.12} ${midY + shoulderHalf}, ${x1} ${midY + shoulderHalf}
      L ${x1} ${y1}`;
  }

  if (e.bottom === 'flat') {
    d += ` L ${x0} ${y1}`;
  } else {
    const dir = e.bottom === 'out' ? 1 : -1;
    d += ` L ${midX + shoulderHalf} ${y1}
      C ${midX + shoulderHalf} ${y1 + dir * depth * 0.12}, ${midX + neckHalf} ${y1 + dir * depth * 0.12}, ${midX + neckHalf} ${y1 + dir * depth * 0.32}
      C ${midX + neckHalf} ${y1 + dir * depth * 0.52}, ${midX + bulbHalf} ${y1 + dir * depth * 0.52}, ${midX + bulbHalf} ${y1 + dir * depth * 0.75}
      C ${midX + bulbHalf} ${y1 + dir * depth * 1.02}, ${midX - bulbHalf} ${y1 + dir * depth * 1.02}, ${midX - bulbHalf} ${y1 + dir * depth * 0.75}
      C ${midX - bulbHalf} ${y1 + dir * depth * 0.52}, ${midX - neckHalf} ${y1 + dir * depth * 0.52}, ${midX - neckHalf} ${y1 + dir * depth * 0.32}
      C ${midX - neckHalf} ${y1 + dir * depth * 0.12}, ${midX - shoulderHalf} ${y1 + dir * depth * 0.12}, ${midX - shoulderHalf} ${y1}
      L ${x0} ${y1}`;
  }

  if (e.left === 'flat') {
    d += ` L ${x0} ${y0}`;
  } else {
    const dir = e.left === 'out' ? -1 : 1;
    d += ` L ${x0} ${midY + shoulderHalf}
      C ${x0 + dir * depth * 0.12} ${midY + shoulderHalf}, ${x0 + dir * depth * 0.12} ${midY + neckHalf}, ${x0 + dir * depth * 0.32} ${midY + neckHalf}
      C ${x0 + dir * depth * 0.52} ${midY + neckHalf}, ${x0 + dir * depth * 0.52} ${midY + bulbHalf}, ${x0 + dir * depth * 0.75} ${midY + bulbHalf}
      C ${x0 + dir * depth * 1.02} ${midY + bulbHalf}, ${x0 + dir * depth * 1.02} ${midY - bulbHalf}, ${x0 + dir * depth * 0.75} ${midY - bulbHalf}
      C ${x0 + dir * depth * 0.52} ${midY - bulbHalf}, ${x0 + dir * depth * 0.52} ${midY - neckHalf}, ${x0 + dir * depth * 0.32} ${midY - neckHalf}
      C ${x0 + dir * depth * 0.12} ${midY - neckHalf}, ${x0 + dir * depth * 0.12} ${midY - shoulderHalf}, ${x0} ${midY - shoulderHalf}
      L ${x0} ${y0}`;
  }

  return `${d} Z`;
}

export function adjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}
