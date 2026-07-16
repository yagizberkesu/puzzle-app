import { solvedPieceCount } from './puzzleGroups';

export function progressOf(record) {
  const total = record?.totalPieces || 0;
  if (!total) return 0;
  const solved =
    typeof record.solvedCount === 'number'
      ? record.solvedCount
      : solvedPieceCount(record.boardGroups || []);

  return Math.min(100, Math.round((solved / total) * 100));
}

export function formatDate(t) {
  if (!t) return '';
  return new Date(t).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
  });
}
