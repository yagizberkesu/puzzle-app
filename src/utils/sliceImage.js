// Cat head silhouette as a normalized SVG path (0–1 coordinate space)
// Drawn left→right along top edge, then forms a closed head shape upward
const CAT_HEAD_NORMALIZED =
  'M 0,0 C 0.1,-0.3 0.15,-0.5 0.2,-0.45 ' +   // left ear approach
  'L 0.18,-0.65 L 0.28,-0.42 ' +                // left ear spike
  'C 0.35,-0.75 0.65,-0.75 0.72,-0.42 ' +       // top of head
  'L 0.82,-0.65 L 0.8,-0.45 ' +                 // right ear spike
  'C 0.85,-0.5 0.9,-0.3 1,0';                   // right ear approach

// Standard interlocking knob along one edge (horizontal, normalized 0–1)
// dir: 1 = knob outward (upward for top edge), -1 = hole inward
function knobPath(dir) {
  const k = dir * 0.3; // bulge magnitude
  return (
    `C 0.3,0 0.35,${-k * 0.5} 0.4,${-k} ` +
    `C 0.45,${-k * 1.3} 0.55,${-k * 1.3} 0.6,${-k} ` +
    `C 0.65,${-k * 0.5} 0.7,0 1,0`
  );
}

// Scale a normalized path string into pixel space for a cell edge
function scaleEdgePath(normalized, x0, y0, edgeLen, axis) {
  return normalized.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (_, nx, ny) => {
    const px = axis === 'h'
      ? x0 + parseFloat(nx) * edgeLen
      : x0 + parseFloat(ny) * edgeLen;
    const py = axis === 'h'
      ? y0 + parseFloat(ny) * edgeLen
      : y0 + parseFloat(nx) * edgeLen;
    return `${px},${py}`;
  });
}

// Returns: { edges[row][col] = {top,right,bottom,left}, whimsies: Set<"r,c"> }
function buildEdgeMap(rows, cols, whimsyRatio = 0.08) {
  // edge[r][c][side]: 0=flat, 1=knob, -1=hole
  const edges = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ top: 0, right: 0, bottom: 0, left: 0 }))
  );
  const whimsies = new Set();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Assign right edge (neighbor gets inverse left)
      if (c < cols - 1) {
        const v = Math.random() < 0.5 ? 1 : -1;
        edges[r][c].right = v;
        edges[r][c + 1].left = -v;
      }
      // Assign bottom edge (neighbor gets inverse top)
      if (r < rows - 1) {
        const v = Math.random() < 0.5 ? 1 : -1;
        edges[r][c].bottom = v;
        edges[r + 1][c].top = -v;
      }
    }
  }

  // Scatter whimsies (cat heads) — avoid edges of grid
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (Math.random() < whimsyRatio) {
        whimsies.add(`${r},${c}`);
        // Override top edge of this piece and bottom edge of piece above
        edges[r][c].top = 'cat';
        edges[r - 1][c].bottom = 'cat_inv';
      }
    }
  }

  return { edges, whimsies };
}

// Build a closed Skia path string for one piece
function buildPiecePath(r, c, cellW, cellH, edgeData) {
  const x = c * cellW;
  const y = r * cellH;
  const { top, right, bottom, left } = edgeData;

  const topEdge = top === 'cat'
    ? scaleEdgePath(CAT_HEAD_NORMALIZED, x, y, cellW, 'h')
    : top === 'cat_inv'
    ? scaleEdgePath(CAT_HEAD_NORMALIZED.replace(/-0\./g, '0.'), x, y, cellW, 'h') // flipped Y
    : `C ${x + cellW * 0.3},${y} ${x + cellW * 0.7},${y} ${x + cellW},${y}`;     // placeholder — replace inner C with knobPath

  // Full path: start top-left, trace clockwise
  return [
    `M ${x},${y}`,
    // Top edge
    top === 'cat' || top === 'cat_inv'
      ? topEdge
      : `${scaleEdgePath('M 0,0 ' + knobPath(top), x, y, cellW, 'h').replace('M ' + x + ',' + y, '')}`,
    // Right edge (rotated 90°)
    scaleEdgePath('L 0,0 ' + knobPath(right), x + cellW, y, cellH, 'v').replace('L ' + (x + cellW) + ',' + y, ''),
    // Bottom edge (right to left, so invert dir)
    scaleEdgePath('L 0,0 ' + knobPath(-bottom), x + cellW, y + cellH, cellW, 'h').replace('L ' + (x + cellW) + ',' + (y + cellH), ''),
    // Left edge (bottom to top, invert dir)
    scaleEdgePath('L 0,0 ' + knobPath(-left), x, y + cellH, cellH, 'v').replace('L ' + x + ',' + (y + cellH), ''),
    'Z',
  ].join(' ');
}

export function sliceImage(uri, totalPieces, imgW, imgH) {
  const cols = Math.round(Math.sqrt(totalPieces * (imgW / imgH)));
  const rows = Math.round(totalPieces / cols);
  const cellW = imgW / cols;
  const cellH = imgH / rows;

  const { edges, whimsies } = buildEdgeMap(rows, cols);

  return Array.from({ length: rows * cols }, (_, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return {
      id: i, r, c, uri,
      imgW, imgH, cellW, cellH,
      isWhimsy: whimsies.has(`${r},${c}`),
      path: buildPiecePath(r, c, cellW, cellH, edges[r][c]),
      edgeData: edges[r][c],
    };
  });
}