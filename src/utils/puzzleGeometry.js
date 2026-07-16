import { Platform } from 'react-native';
import { width } from '../constants/layout';
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
  const maxSize = width > 900 ? 72 : Platform.OS === 'android' ? 48 : 54;
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

export function createPieces(uri, totalPieces) {
  const grid = Math.round(Math.sqrt(totalPieces));
  const stamp = Date.now();

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
    };
  });
}

export function inverse(e) {
  if (e === 'out') return 'in';
  if (e === 'in') return 'out';
  return 'flat';
}

export function verticalEdge(row, col) {
  return (row + col) % 2 === 0 ? 'out' : 'in';
}

export function horizontalEdge(row, col) {
  return (row + col) % 2 === 0 ? 'out' : 'in';
}

export function edgesOf(piece) {
  return {
    top:
      piece.row === 0
        ? 'flat'
        : inverse(horizontalEdge(piece.row - 1, piece.col)),
    right:
      piece.col === piece.cols - 1 ? 'flat' : verticalEdge(piece.row, piece.col),
    bottom:
      piece.row === piece.rows - 1 ? 'flat' : horizontalEdge(piece.row, piece.col),
    left:
      piece.col === 0
        ? 'flat'
        : inverse(verticalEdge(piece.row, piece.col - 1)),
  };
}

export function jigsawPath(piece, size) {
  const oh = overhang(size);

  const x0 = oh;
  const y0 = oh;
  const x1 = oh + size;
  const y1 = oh + size;

  const midX = oh + size / 2;
  const midY = oh + size / 2;

  const neck = size * 0.1;
  const head = size * 0.18;
  const depth = size * 0.21;

  const e = edgesOf(piece);

  let d = `M ${x0} ${y0}`;

  if (e.top === 'flat') {
    d += ` L ${x1} ${y0}`;
  } else {
    const dir = e.top === 'out' ? -1 : 1;
    d += ` L ${midX - head} ${y0}
      C ${midX - head * 0.75} ${y0}, ${midX - neck} ${y0 + dir * depth * 0.15}, ${midX - neck} ${y0 + dir * depth * 0.45}
      C ${midX - neck} ${y0 + dir * depth}, ${midX + neck} ${y0 + dir * depth}, ${midX + neck} ${y0 + dir * depth * 0.45}
      C ${midX + neck} ${y0 + dir * depth * 0.15}, ${midX + head * 0.75} ${y0}, ${midX + head} ${y0}
      L ${x1} ${y0}`;
  }

  if (e.right === 'flat') {
    d += ` L ${x1} ${y1}`;
  } else {
    const dir = e.right === 'out' ? 1 : -1;
    d += ` L ${x1} ${midY - head}
      C ${x1} ${midY - head * 0.75}, ${x1 + dir * depth * 0.15} ${midY - neck}, ${x1 + dir * depth * 0.45} ${midY - neck}
      C ${x1 + dir * depth} ${midY - neck}, ${x1 + dir * depth} ${midY + neck}, ${x1 + dir * depth * 0.45} ${midY + neck}
      C ${x1 + dir * depth * 0.15} ${midY + neck}, ${x1} ${midY + head * 0.75}, ${x1} ${midY + head}
      L ${x1} ${y1}`;
  }

  if (e.bottom === 'flat') {
    d += ` L ${x0} ${y1}`;
  } else {
    const dir = e.bottom === 'out' ? 1 : -1;
    d += ` L ${midX + head} ${y1}
      C ${midX + head * 0.75} ${y1}, ${midX + neck} ${y1 + dir * depth * 0.15}, ${midX + neck} ${y1 + dir * depth * 0.45}
      C ${midX + neck} ${y1 + dir * depth}, ${midX - neck} ${y1 + dir * depth}, ${midX - neck} ${y1 + dir * depth * 0.45}
      C ${midX - neck} ${y1 + dir * depth * 0.15}, ${midX - head * 0.75} ${y1}, ${midX - head} ${y1}
      L ${x0} ${y1}`;
  }

  if (e.left === 'flat') {
    d += ` L ${x0} ${y0}`;
  } else {
    const dir = e.left === 'out' ? -1 : 1;
    d += ` L ${x0} ${midY + head}
      C ${x0} ${midY + head * 0.75}, ${x0 + dir * depth * 0.15} ${midY + neck}, ${x0 + dir * depth * 0.45} ${midY + neck}
      C ${x0 + dir * depth} ${midY + neck}, ${x0 + dir * depth} ${midY - neck}, ${x0 + dir * depth * 0.45} ${midY - neck}
      C ${x0 + dir * depth * 0.15} ${midY - neck}, ${x0} ${midY - head * 0.75}, ${x0} ${midY - head}
      L ${x0} ${y0}`;
  }

  return `${d} Z`;
}

export function adjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}
