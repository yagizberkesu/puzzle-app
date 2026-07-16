import { adjacent, clamp, pieceSize, solvedPosition, visualSize } from './puzzleGeometry';
import { BREAKPOINT_COMPACT, width } from '../constants/layout';
import { BOARD_PADDING, FRAME_SNAP, GROUP_SNAP } from '../constants/puzzle';

export function groupPieceCount(groups) {
  return groups.reduce((sum, g) => sum + g.pieces.length, 0);
}

export function solvedPieceCount(groups) {
  return groups
    .filter((g) => g.anchoredToFrame)
    .reduce((sum, g) => sum + g.pieces.length, 0);
}

export function createGroup(piece, index, origin, boardLayout, custom) {
  const size = pieceSize(piece);
  const vs = visualSize(size);
  const frameHeight = size * piece.rows;

  const columns = width < BREAKPOINT_COMPACT ? 3 : 4;
const defaultX = origin.x + (index % columns) * (vs + 10);
const defaultY =
  origin.y + frameHeight + 28 + Math.floor(index / columns) * (vs + 10);

  const maxX = Math.max(
    BOARD_PADDING,
    (boardLayout?.width || width) - vs - BOARD_PADDING
  );

  const maxY = Math.max(
    BOARD_PADDING,
    (boardLayout?.height || 700) - vs - BOARD_PADDING
  );

  return {
    id: `group-${piece.id}-${Date.now()}`,
    x: clamp(custom?.x ?? defaultX, BOARD_PADDING, maxX),
    y: clamp(custom?.y ?? defaultY, BOARD_PADDING, maxY),
    pieces: [{ ...piece, relX: 0, relY: 0 }],
    anchoredToFrame: false,
  };
}

export function groupBounds(group) {
  const size = pieceSize(group.pieces[0]);
  const vs = visualSize(size);

  let maxX = 0;
  let maxY = 0;

  group.pieces.forEach((p) => {
    maxX = Math.max(maxX, p.relX + vs);
    maxY = Math.max(maxY, p.relY + vs);
  });

  return { width: maxX, height: maxY };
}

export function groupSnapTarget(dragged, others) {
  for (const other of others) {
    for (const dp of dragged.pieces) {
      for (const op of other.pieces) {
        if (!adjacent(dp, op)) continue;

        const size = pieceSize(dp);
        const threshold = Math.max(18, size * GROUP_SNAP);

        const targetX =
          other.x + op.relX + (dp.col - op.col) * size - dp.relX;

        const targetY =
          other.y + op.relY + (dp.row - op.row) * size - dp.relY;

        if (
          Math.abs(dragged.x - targetX) <= threshold &&
          Math.abs(dragged.y - targetY) <= threshold
        ) {
          return { other, targetX, targetY };
        }
      }
    }
  }

  return null;
}

export function frameSnapTarget(group, origin) {
  for (const p of group.pieces) {
    if (!p.isEdge) continue;

    const solved = solvedPosition(p, origin);
    const size = pieceSize(p);
    const threshold = Math.max(18, size * FRAME_SNAP);

    const targetX = solved.x - p.relX;
    const targetY = solved.y - p.relY;

    if (
      Math.abs(group.x - targetX) <= threshold &&
      Math.abs(group.y - targetY) <= threshold
    ) {
      return { targetX, targetY };
    }
  }

  return null;
}

export function mergeGroups(dragged, other, targetX, targetY) {
  const all = [
    ...other.pieces.map((p) => ({
      ...p,
      absX: other.x + p.relX,
      absY: other.y + p.relY,
    })),
    ...dragged.pieces.map((p) => ({
      ...p,
      absX: targetX + p.relX,
      absY: targetY + p.relY,
    })),
  ];

  const originX = Math.min(...all.map((p) => p.absX));
  const originY = Math.min(...all.map((p) => p.absY));

  return {
    id: `group-${Date.now()}-${all.length}`,
    x: originX,
    y: originY,
    pieces: all.map(({ absX, absY, ...p }) => ({
      ...p,
      relX: absX - originX,
      relY: absY - originY,
    })),
    anchoredToFrame: dragged.anchoredToFrame || other.anchoredToFrame,
  };
}
