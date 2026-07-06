import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Image as SvgImage,
  Line,
  Path,
  Rect,
} from 'react-native-svg';

const { width, height } = Dimensions.get('window');

const STORAGE_KEY = 'PUZZLE_APP_SAVED_PUZZLES_V2';
const SELECT_MODE_INDEX = 2;
const SEND_COUNT = 20;
const BOARD_PADDING = 16;
const TAB_RATIO = 0.2;
const FRAME_SNAP = 0.85;
const GROUP_SNAP = 0.42;
const TRAY_COLS = width > 900 ? 6 : 4;
const DIFFICULTIES = [36, 64, 100, 144, 196, 256];

const THEME = {
  bg: '#f2f2f2',
  top: '#fbfbfb',
  topLine: '#dddddd',
  board: '#e5e5e5',
  boardLine: '#d4d4d4',
  text: '#202020',
  muted: '#777777',
  soft: '#aaaaaa',
  purple: '#5f43aa',
  purple2: '#8e6ad8',
  purpleSoft: '#eee8ff',
  orange: '#c47b18',
  white: '#ffffff',
  black: '#181818',
};

const PRESETS = [
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

const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  id: `c-${i}`,
  left: `${6 + ((i * 17) % 88)}%`,
  size: 13 + (i % 5) * 4,
  rotate: i % 2 ? '-24deg' : '20deg',
  emoji: ['💜', '✨', '🎉', '⭐'][i % 4],
}));

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function distance(touches) {
  if (!touches || touches.length < 2) return 0;
  const [a, b] = touches;
  return Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY);
}

function center(touches) {
  if (!touches || touches.length < 2) return { x: 0, y: 0 };
  const [a, b] = touches;
  return { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 };
}

function groupPieceCount(groups) {
  return groups.reduce((sum, g) => sum + g.pieces.length, 0);
}

function solvedPieceCount(groups) {
  return groups
    .filter((g) => g.anchoredToFrame)
    .reduce((sum, g) => sum + g.pieces.length, 0);
}

function progressOf(record) {
  const total = record?.totalPieces || 0;
  if (!total) return 0;
  const solved =
    typeof record.solvedCount === 'number'
      ? record.solvedCount
      : solvedPieceCount(record.boardGroups || []);

  return Math.min(100, Math.round((solved / total) * 100));
}

function formatDate(t) {
  if (!t) return '';
  return new Date(t).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
  });
}

function pieceSize(piece) {
  const cols = piece?.cols || 4;
  const maxSize = width > 900 ? 72 : Platform.OS === 'android' ? 48 : 54;
  const availableWidth = width - 92;

  return Math.min(maxSize, availableWidth / cols);
}

function overhang(size) {
  return size * TAB_RATIO;
}

function visualSize(size) {
  return size + overhang(size) * 2;
}

function frameOrigin(piece, layout) {
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

function solvedPosition(piece, origin) {
  const size = pieceSize(piece);
  const oh = overhang(size);

  return {
    x: origin.x + piece.col * size - oh,
    y: origin.y + piece.row * size - oh,
  };
}

function createPieces(uri, totalPieces) {
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

function inverse(e) {
  if (e === 'out') return 'in';
  if (e === 'in') return 'out';
  return 'flat';
}

function verticalEdge(row, col) {
  return (row + col) % 2 === 0 ? 'out' : 'in';
}

function horizontalEdge(row, col) {
  return (row + col) % 2 === 0 ? 'out' : 'in';
}

function edgesOf(piece) {
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

function jigsawPath(piece, size) {
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

function TopBarIcon({ type, active = false, disabled = false }) {
  const stroke = disabled ? '#b8b8b8' : active ? THEME.purple : THEME.black;

  if (type === 'back') {
    return (
      <Svg width={30} height={30} viewBox="0 0 30 30">
        <Line
          x1="19"
          y1="6"
          x2="9"
          y2="15"
          stroke={stroke}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <Line
          x1="9"
          y1="15"
          x2="19"
          y2="24"
          stroke={stroke}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <Line
          x1="10"
          y1="15"
          x2="27"
          y2="15"
          stroke={stroke}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (type === 'broom') {
    return (
      <Svg width={30} height={30} viewBox="0 0 30 30">
        <Line
          x1="18"
          y1="4"
          x2="14"
          y2="13"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Path
          d="M10 13 H23 L21 24 H7 Z"
          stroke={stroke}
          strokeWidth={2}
          fill="none"
          strokeLinejoin="round"
        />
        <Line
          x1="10"
          y1="17"
          x2="21"
          y2="17"
          stroke={stroke}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <Line
          x1="10"
          y1="21"
          x2="20"
          y2="21"
          stroke={stroke}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (type === 'edge') {
    return (
      <Svg width={30} height={30} viewBox="0 0 30 30">
        <Line
          x1="8"
          y1="23"
          x2="23"
          y2="8"
          stroke={stroke}
          strokeWidth={2.1}
          strokeLinecap="round"
        />
        <Line
          x1="14"
          y1="24"
          x2="24"
          y2="14"
          stroke={stroke}
          strokeWidth={2.1}
          strokeLinecap="round"
        />
        <Line
          x1="6"
          y1="16"
          x2="16"
          y2="6"
          stroke={stroke}
          strokeWidth={2.1}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (type === 'hint') {
    return (
      <Svg width={32} height={32} viewBox="0 0 32 32">
        <Path
          d="M10 14.5 C10 10.5 12.7 8 16 8 C19.3 8 22 10.5 22 14.5 C22 17.2 20.5 18.9 18.7 20.3 C18.1 20.8 17.8 21.3 17.8 22 H14.2 C14.2 20.6 14.8 19.5 15.9 18.6 C17.4 17.4 18.2 16.4 18.2 14.7 C18.2 12.9 17.3 11.8 16 11.8 C14.7 11.8 13.8 12.9 13.8 14.5"
          stroke={stroke}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Line
          x1="14"
          y1="25"
          x2="18"
          y2="25"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (type === 'reference') {
    return (
      <Svg width={32} height={32} viewBox="0 0 32 32">
        <Rect
          x="8"
          y="8"
          width="16"
          height="16"
          stroke={stroke}
          strokeWidth={1.8}
          fill="none"
          strokeDasharray="4 3"
        />
        <Path
          d="M13 19 L17 19 L17 15 L21 15 L21 21 L13 21 Z"
          stroke={stroke}
          strokeWidth={1.8}
          fill="none"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (type === 'eye') {
    return (
      <Svg width={34} height={34} viewBox="0 0 34 34">
        <Path
          d="M4 17 C7.8 10.8 12.3 8 17 8 C21.7 8 26.2 10.8 30 17 C26.2 23.2 21.7 26 17 26 C12.3 26 7.8 23.2 4 17 Z"
          stroke={stroke}
          strokeWidth={2}
          fill="none"
          strokeLinejoin="round"
        />
        <Circle cx="17" cy="17" r="4.2" stroke={stroke} strokeWidth={2} fill="none" />
      </Svg>
    );
  }

  return null;
}

const PieceImage = React.memo(function PieceImage({
  piece,
  size,
  highlightColor,
}) {
  const oh = overhang(size);
  const vs = visualSize(size);

  const path = useMemo(
    () => jigsawPath(piece, size),
    [piece.id, piece.row, piece.col, piece.rows, piece.cols, size]
  );

  const clipId = useMemo(
    () =>
      `clip_${String(piece.id).replace(/[^a-zA-Z0-9_]/g, '_')}_${Math.round(
        size * 1000
      )}`,
    [piece.id, size]
  );

  return (
    <View style={[styles.pieceImageBox, { width: vs, height: vs }]}>
      <Svg width={vs} height={vs} viewBox={`0 0 ${vs} ${vs}`}>
        <Defs>
          <ClipPath id={clipId}>
            <Path d={path} />
          </ClipPath>
        </Defs>

        <SvgImage
          href={{ uri: piece.uri }}
          x={oh - piece.col * size}
          y={oh - piece.row * size}
          width={size * piece.cols}
          height={size * piece.rows}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />

        {highlightColor ? (
          <Path d={path} fill="none" stroke={highlightColor} strokeWidth={1.15} />
        ) : (
          <>
            <Path d={path} fill="none" stroke="#00000035" strokeWidth={1.05} />
            <Path d={path} fill="none" stroke="#ffffff22" strokeWidth={0.35} />
          </>
        )}
      </Svg>
    </View>
  );
});

function adjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function createGroup(piece, index, origin, boardLayout, custom) {
  const size = pieceSize(piece);
  const vs = visualSize(size);
  const frameHeight = size * piece.rows;

  const columns = width < 700 ? 3 : 4;
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

function groupBounds(group) {
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

function groupSnapTarget(dragged, others) {
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

function frameSnapTarget(group, origin) {
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

function mergeGroups(dragged, other, targetX, targetY) {
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

const DraggableGroup = React.memo(function DraggableGroup({
  group,
  onMoveEnd,
  getBoardScale,
}) {
  const pan = useRef(new Animated.ValueXY({ x: group.x, y: group.y })).current;
  const bounds = groupBounds(group);
  const z = group.anchoredToFrame ? 10 : group.pieces.length > 1 ? 20 : 30;

  useEffect(() => {
    pan.setValue({ x: group.x, y: group.y });
  }, [group.x, group.y, pan]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !group.anchoredToFrame,
        onMoveShouldSetPanResponder: () => !group.anchoredToFrame,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,

        onPanResponderGrant: () => {
          if (!group.anchoredToFrame) {
            pan.setValue({ x: group.x, y: group.y });
          }
        },

        onPanResponderMove: (_e, g) => {
          if (group.anchoredToFrame) return;

          const scale = Math.max(0.35, getBoardScale?.() || 1);

          pan.setValue({
            x: group.x + g.dx / scale,
            y: group.y + g.dy / scale,
          });
        },

        onPanResponderRelease: () => {
          if (group.anchoredToFrame) return;

          const next = onMoveEnd(group.id, {
            x: pan.x._value,
            y: pan.y._value,
          });

          if (next) {
            pan.setValue({ x: next.x, y: next.y });
          }
        },

        onPanResponderTerminate: () => {
          pan.setValue({ x: group.x, y: group.y });
        },
      }),
    [
      group.id,
      group.x,
      group.y,
      group.anchoredToFrame,
      getBoardScale,
      onMoveEnd,
      pan,
    ]
  );

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        styles.boardGroup,
        {
          width: bounds.width,
          height: bounds.height,
          zIndex: z,
          elevation: z,
          transform: pan.getTranslateTransform(),
        },
      ]}
    >
      {group.pieces.map((p) => {
        const size = pieceSize(p);
        const vs = visualSize(size);

        return (
          <View
            key={p.id}
            style={[
              styles.groupPiece,
              {
                left: p.relX,
                top: p.relY,
                width: vs,
                height: vs,
              },
            ]}
          >
            <PieceImage piece={p} size={size} />
          </View>
        );
      })}
    </Animated.View>
  );
});

const TrayPieceItem = React.memo(function TrayPieceItem({
  item,
  isSelected,
  isSelectionMode,
  trayVisualSize,
  trayPieceSize,
  onToggleSelect,
  onDragToBoard,
  onDragStart,
  onDragMove,
  onDragEnd,
}) {
  const [dragging, setDragging] = useState(false);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isSelectionMode,
        onStartShouldSetPanResponderCapture: () => !isSelectionMode,
        onMoveShouldSetPanResponder: () => !isSelectionMode,
        onMoveShouldSetPanResponderCapture: () => !isSelectionMode,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,

        onPanResponderGrant: (event, gesture) => {
          if (isSelectionMode) return;

          const pageX = event.nativeEvent.pageX ?? gesture.x0;
          const pageY = event.nativeEvent.pageY ?? gesture.y0;

          setDragging(true);
          onDragStart?.(item, { x: pageX, y: pageY });
        },

        onPanResponderMove: (event, gesture) => {
          if (isSelectionMode) return;

          const pageX = event.nativeEvent.pageX ?? gesture.moveX;
          const pageY = event.nativeEvent.pageY ?? gesture.moveY;

          onDragMove?.(item, { x: pageX, y: pageY });
        },

        onPanResponderRelease: (event, gesture) => {
          if (isSelectionMode) return;

          const pageX = event.nativeEvent.pageX ?? gesture.moveX;
          const pageY = event.nativeEvent.pageY ?? gesture.moveY;

          setDragging(false);
          onDragToBoard(item, { x: pageX, y: pageY });

          requestAnimationFrame(() => {
            onDragEnd?.();
          });
        },

        onPanResponderTerminate: () => {
          setDragging(false);
          onDragEnd?.();
        },
      }),
    [isSelectionMode, item, onDragToBoard, onDragStart, onDragMove, onDragEnd]
  );

  if (isSelectionMode) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onToggleSelect(item.id)}
        style={[
          styles.trayPiece,
          {
            width: trayVisualSize,
            height: trayVisualSize,
          },
          isSelected && styles.selectedTrayPiece,
        ]}
      >
        <PieceImage
          piece={item}
          size={trayPieceSize}
          highlightColor={isSelected ? THEME.purple2 : undefined}
        />

        {isSelected && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View
      {...responder.panHandlers}
      style={[
        styles.trayPiece,
        styles.dragTrayPiece,
        dragging && styles.trayPieceDragging,
        {
          width: trayVisualSize,
          height: trayVisualSize,
        },
      ]}
    >
      <PieceImage piece={item} size={trayPieceSize} />
    </View>
  );
});

const FloatingReference = React.memo(function FloatingReference({
  uri,
  onClose,
}) {
  const refPan = useRef(
    new Animated.ValueXY({
      x: width * 0.18,
      y: 112,
    })
  ).current;

  const refScale = useRef(new Animated.Value(1)).current;

  const g = useRef({
    startX: width * 0.18,
    startY: 112,
    lastX: width * 0.18,
    lastY: 112,
    startScale: 1,
    lastScale: 1,
    startDistance: 0,
  }).current;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (event) => {
          const touches = event.nativeEvent.touches || [];

          g.startX = g.lastX;
          g.startY = g.lastY;
          g.startScale = g.lastScale;

          if (touches.length >= 2) {
            g.startDistance = distance(touches);
          }
        },

        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches || [];

          if (touches.length >= 2) {
            const ratio =
              g.startDistance > 0 ? distance(touches) / g.startDistance : 1;

            const next = clamp(g.startScale * ratio, 0.55, 2.4);

            g.lastScale = next;
            refScale.setValue(next);

            return;
          }

          g.lastX = g.startX + gesture.dx;
          g.lastY = g.startY + gesture.dy;

          refPan.setValue({
            x: g.lastX,
            y: g.lastY,
          });
        },

        onPanResponderRelease: () => {
          g.startX = g.lastX;
          g.startY = g.lastY;
          g.startScale = g.lastScale;
        },
      }),
    [g, refPan, refScale]
  );

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        styles.floatingReference,
        {
          transform: [...refPan.getTranslateTransform(), { scale: refScale }],
        },
      ]}
    >
      <Image
        source={{ uri }}
        style={styles.floatingReferenceImage}
        resizeMode="cover"
      />

      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.floatingReferenceClose}
        onPress={onClose}
      >
        <Text style={styles.floatingReferenceCloseText}>×</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

const CompletionModal = React.memo(function CompletionModal({
  visible,
  progress,
  totalPieces,
  solvedCount,
  onClose,
  onHome,
  onNewPuzzle,
}) {
  const fall = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      fall.setValue(0);
      pulse.setValue(1);
      return;
    }

    fall.setValue(0);
    pulse.setValue(0.86);

    Animated.parallel([
      Animated.timing(fall, {
        toValue: 1,
        duration: 1700,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.spring(pulse, {
          toValue: 1,
          friction: 4,
          tension: 90,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fall, pulse, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.completionOverlay}>
        <View pointerEvents="none" style={styles.confettiLayer}>
          {CONFETTI.map((item, index) => {
            const translateY = fall.interpolate({
              inputRange: [0, 1],
              outputRange: [-80 - index * 2, height * 0.72],
            });

            const opacity = fall.interpolate({
              inputRange: [0, 0.12, 0.78, 1],
              outputRange: [0, 1, 1, 0],
            });

            return (
              <Animated.Text
                key={item.id}
                style={[
                  styles.confettiItem,
                  {
                    left: item.left,
                    fontSize: item.size,
                    opacity,
                    transform: [{ translateY }, { rotate: item.rotate }],
                  },
                ]}
              >
                {item.emoji}
              </Animated.Text>
            );
          })}
        </View>

        <Animated.View
          style={[
            styles.completionCard,
            {
              transform: [{ scale: pulse }],
            },
          ]}
        >
          <View style={styles.completionIconCircle}>
            <Text style={styles.completionIcon}>💜</Text>
          </View>

          <Text style={styles.completionTitle}>Aferim!</Text>

          <Text style={styles.completionSubtitle}>
            Puzzle tamamlandı. Baya iyi gittin.
          </Text>

          <View style={styles.completionStatsRow}>
            <View style={styles.completionStatBox}>
              <Text style={styles.completionStatValue}>%{progress}</Text>
              <Text style={styles.completionStatLabel}>İlerleme</Text>
            </View>

            <View style={styles.completionStatBox}>
              <Text style={styles.completionStatValue}>
                {solvedCount}/{totalPieces}
              </Text>
              <Text style={styles.completionStatLabel}>Parça</Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.completionPrimaryBtn}
            onPress={onHome}
          >
            <Text style={styles.completionPrimaryBtnText}>Ana Sayfaya Dön</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.completionSecondaryBtn}
            onPress={onNewPuzzle}
          >
            <Text style={styles.completionSecondaryBtnText}>Yeni Puzzle Ekle</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.completionGhostBtn}
            onPress={onClose}
          >
            <Text style={styles.completionGhostBtnText}>Ekranda Kal</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
});

export default function PuzzleScreen() {
  const sheetRef = useRef(null);
  const boardRef = useRef(null);
  const containerRef = useRef(null);

  const screenOffsetRef = useRef({ x: 0, y: 0 });
  const dragPreviewRef = useRef(null);
  const saveTimerRef = useRef(null);
  const completionShownRef = useRef(false);

  const boardScaleRef = useRef(1);
  const boardPanRef = useRef({ x: 0, y: 0 });
  const boardGestureRef = useRef({
    startScale: 1,
    startPanX: 0,
    startPanY: 0,
    startDistance: 0,
    startCenterX: 0,
    startCenterY: 0,
  });

  const dragPreviewPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const boardPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const boardScale = useRef(new Animated.Value(1)).current;

  const [screenMode, setScreenMode] = useState('home');
  const [savedPuzzles, setSavedPuzzles] = useState([]);
  const [homeLoading, setHomeLoading] = useState(true);
  const [activePuzzleId, setActivePuzzleId] = useState(null);
  const [pendingPuzzleId, setPendingPuzzleId] = useState(null);
  const [pendingPuzzleTitle, setPendingPuzzleTitle] = useState('Yeni Puzzle');

  const [sourceImage, setSourceImage] = useState(null);
  const [pieces, setPieces] = useState([]);
  const [boardGroups, setBoardGroups] = useState([]);

  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [hintOn, setHintOn] = useState(false);

  const [pendingUri, setPendingUri] = useState(null);
  const [edgeOnly, setEdgeOnly] = useState(false);
  const [selectedPieceIds, setSelectedPieceIds] = useState([]);

  const [sheetIndex, setSheetIndex] = useState(0);
  const [dragPreview, setDragPreview] = useState(null);
  const [isTrayPieceDragging, setIsTrayPieceDragging] = useState(false);

  const [boardLayout, setBoardLayout] = useState({
    x: 0,
    y: 0,
    width,
    height: 600,
  });

  const [boardWindowLayout, setBoardWindowLayout] = useState({
    x: 0,
    y: 0,
    width,
    height: 600,
  });

  const isSelectionMode = sheetIndex === SELECT_MODE_INDEX;

  const activePiece = boardGroups[0]?.pieces?.[0] || pieces[0] || null;
  const activePieceSize = pieceSize(activePiece);
  const origin = frameOrigin(activePiece, boardLayout);

  const trayCellSize = (width - 48) / TRAY_COLS;
  const trayPieceSize = trayCellSize / (1 + TAB_RATIO * 2);
  const trayVisualSize = visualSize(trayPieceSize);

  const snapPoints = useMemo(() => {
  const one = 72 + trayVisualSize + 8;
  const two = 72 + trayVisualSize * 2 + 18;
  const full = width < 700 ? height * 0.54 : height * 0.72;

  return [
    Math.min(one, height * 0.36),
    Math.min(two, height * 0.46),
    full,
  ];
}, [trayVisualSize]);

  const visiblePieces = useMemo(() => {
    if (edgeOnly) return pieces.filter((p) => p.isEdge);
    return pieces;
  }, [pieces, edgeOnly]);

  const anchoredGroups = useMemo(
    () => boardGroups.filter((g) => g.anchoredToFrame),
    [boardGroups]
  );

  const connectedGroups = useMemo(
    () =>
      boardGroups.filter((g) => !g.anchoredToFrame && g.pieces.length > 1),
    [boardGroups]
  );

  const looseSingleGroups = useMemo(
    () =>
      boardGroups.filter((g) => !g.anchoredToFrame && g.pieces.length === 1),
    [boardGroups]
  );

  const orderedGroups = useMemo(
    () => [...anchoredGroups, ...connectedGroups, ...looseSingleGroups],
    [anchoredGroups, connectedGroups, looseSingleGroups]
  );

  const selectedCount = selectedPieceIds.length;
  const sendCountLabel = Math.min(SEND_COUNT, visiblePieces.length);

  const sendButtonLabel =
    selectedCount > 0
      ? `Seçilenleri Gönder (${selectedCount})`
      : `${sendCountLabel} Parça Gönder`;

  const totalPieces = pieces.length + groupPieceCount(boardGroups);
  const currentSolvedCount = solvedPieceCount(boardGroups);

  const currentProgress =
    totalPieces > 0
      ? Math.min(100, Math.round((currentSolvedCount / totalPieces) * 100))
      : 0;

  const puzzleCompleted =
    screenMode === 'puzzle' &&
    totalPieces > 0 &&
    currentSolvedCount === totalPieces;

  const referenceWidth = activePiece ? activePieceSize * activePiece.cols : 0;
  const referenceHeight = activePiece ? activePieceSize * activePiece.rows : 0;

  const sortedSaved = useMemo(
    () => [...savedPuzzles].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    [savedPuzzles]
  );

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const parsed = raw ? JSON.parse(raw) : [];

        if (mounted && Array.isArray(parsed)) {
          setSavedPuzzles(parsed);
        }
      })
      .catch((e) => {
        console.log('Puzzle storage load error:', e);
      })
      .finally(() => {
        if (mounted) setHomeLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const persistPuzzles = useCallback((next) => {
    setSavedPuzzles(next);

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((e) => {
      console.log('Puzzle storage save error:', e);
    });
  }, []);

  const updatePuzzleRecord = useCallback((id, updater) => {
    setSavedPuzzles((prev) => {
      const next = prev.map((r) => (r.id === id ? updater(r) : r));

      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((e) => {
        console.log('Puzzle storage save error:', e);
      });

      return next;
    });
  }, []);

  useEffect(() => {
    if (
      screenMode !== 'puzzle' ||
      !activePuzzleId ||
      !sourceImage ||
      totalPieces === 0
    ) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      const solved = solvedPieceCount(boardGroups);
      const progress = Math.min(100, Math.round((solved / totalPieces) * 100));

      updatePuzzleRecord(activePuzzleId, (r) => ({
        ...r,
        imageUri: sourceImage,
        totalPieces,
        pieces,
        boardGroups,
        solvedCount: solved,
        progress,
        completed: progress >= 100,
        updatedAt: Date.now(),
      }));
    }, 450);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    activePuzzleId,
    boardGroups,
    pieces,
    screenMode,
    sourceImage,
    totalPieces,
    updatePuzzleRecord,
  ]);

  useEffect(() => {
    if (!puzzleCompleted || !activePuzzleId) return;

    updatePuzzleRecord(activePuzzleId, (r) => ({
      ...r,
      solvedCount: currentSolvedCount,
      progress: 100,
      completed: true,
      updatedAt: Date.now(),
    }));

    if (!completionShownRef.current) {
      completionShownRef.current = true;
      setCompletionOpen(true);
    }
  }, [activePuzzleId, currentSolvedCount, puzzleCompleted, updatePuzzleRecord]);

  const measureContainer = useCallback(() => {
    requestAnimationFrame(() => {
      containerRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
        screenOffsetRef.current = {
          x: pageX || 0,
          y: pageY || 0,
        };
      });
    });
  }, []);

  const measureBoard = useCallback(() => {
    requestAnimationFrame(() => {
      boardRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
        setBoardWindowLayout({
          x: pageX || 0,
          y: pageY || 0,
          width: w,
          height: h,
        });
      });
    });
  }, []);

  const getBoardScale = useCallback(() => boardScaleRef.current, []);

  const resetBoardCamera = useCallback(() => {
    boardScaleRef.current = 1;
    boardPanRef.current = {
      x: 0,
      y: 0,
    };

    boardScale.setValue(1);
    boardPan.setValue({
      x: 0,
      y: 0,
    });
  }, [boardPan, boardScale]);

  const boardPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (e) =>
          (e.nativeEvent.touches || []).length >= 2,
        onMoveShouldSetPanResponder: (e) =>
          (e.nativeEvent.touches || []).length >= 2,
        onStartShouldSetPanResponderCapture: (e) =>
          (e.nativeEvent.touches || []).length >= 2,
        onMoveShouldSetPanResponderCapture: (e) =>
          (e.nativeEvent.touches || []).length >= 2,
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (e) => {
          const touches = e.nativeEvent.touches || [];
          const c = center(touches);

          boardGestureRef.current = {
            startScale: boardScaleRef.current,
            startPanX: boardPanRef.current.x,
            startPanY: boardPanRef.current.y,
            startDistance: distance(touches),
            startCenterX: c.x,
            startCenterY: c.y,
          };
        },

        onPanResponderMove: (e) => {
          const touches = e.nativeEvent.touches || [];
          if (touches.length < 2) return;

          const c = center(touches);
          const g = boardGestureRef.current;

          const ratio =
            g.startDistance > 0 ? distance(touches) / g.startDistance : 1;

          const nextScale = clamp(g.startScale * ratio, 0.65, 3.2);

          const nextPan = {
            x: g.startPanX + (c.x - g.startCenterX),
            y: g.startPanY + (c.y - g.startCenterY),
          };

          boardScaleRef.current = nextScale;
          boardPanRef.current = nextPan;

          boardScale.setValue(nextScale);
          boardPan.setValue(nextPan);
        },
      }),
    [boardPan, boardScale]
  );

  const normalizeAssetUri = useCallback((uri) => {
    if (Platform.OS === 'android' && uri && !uri.includes('://')) {
      return `file://${uri}`;
    }

    return uri;
  }, []);

  const queueDifficulty = useCallback((record) => {
    setPendingUri(record.imageUri);
    setPendingPuzzleId(record.id);
    setPendingPuzzleTitle(record.title || 'Yeni Puzzle');
    setDifficultyOpen(true);
  }, []);

  const createPuzzleCard = useCallback(
    (uri, title = 'Yeni Puzzle') => {
      const now = Date.now();

      const record = {
        id: `puzzle-${now}`,
        title,
        imageUri: uri,
        createdAt: now,
        updatedAt: now,
        totalPieces: null,
        pieces: [],
        boardGroups: [],
        solvedCount: 0,
        progress: 0,
        completed: false,
      };

      persistPuzzles([record, ...savedPuzzles]);
      queueDifficulty(record);
    },
    [persistPuzzles, queueDifficulty, savedPuzzles]
  );

  const pickFromGallery = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'İzin gerekli',
          'Galeriden görsel seçebilmek için fotoğraf erişim izni vermelisin.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
        base64: false,
        exif: false,
        legacy: Platform.OS === 'android',
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      const pickedUri = normalizeAssetUri(result.assets[0].uri);

      const img = await ImageManipulator.manipulateAsync(
        pickedUri,
        [
          {
            resize: {
              width: 1024,
            },
          },
        ],
        {
          compress: 0.9,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      createPuzzleCard(img.uri, 'Galeriden Puzzle');
    } catch (e) {
      console.log('Gallery pick error:', e);

      Alert.alert(
        'Görsel seçilemedi',
        'Farklı bir görsel dene veya uygulama izinlerini kontrol et.'
      );
    }
  }, [createPuzzleCard, normalizeAssetUri]);

  const openSavedPuzzle = useCallback(
    (record) => {
      if (!record.totalPieces) {
        queueDifficulty(record);
        return;
      }

      setActivePuzzleId(record.id);
      setSourceImage(record.imageUri);

      setPieces(
        Array.isArray(record.pieces) && record.pieces.length
          ? record.pieces
          : createPieces(record.imageUri, record.totalPieces)
      );

      setBoardGroups(Array.isArray(record.boardGroups) ? record.boardGroups : []);
      setSelectedPieceIds([]);
      setEdgeOnly(false);
      setHintOn(false);
      setSheetIndex(0);
      setDragPreview(null);
      setIsTrayPieceDragging(false);
      setCompletionOpen(false);

      completionShownRef.current = Boolean(record.completed);

      setScreenMode('puzzle');

      dragPreviewRef.current = null;
      dragPreviewPan.setValue({
        x: 0,
        y: 0,
      });

      resetBoardCamera();

      requestAnimationFrame(() => {
        sheetRef.current?.snapToIndex(0);
      });
    },
    [dragPreviewPan, queueDifficulty, resetBoardCamera]
  );

  const deletePuzzle = useCallback(
    (id) => {
      Alert.alert('Puzzle silinsin mi?', 'Bu kayıt ana sayfadan kaldırılacak.', [
        {
          text: 'Vazgeç',
          style: 'cancel',
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            persistPuzzles(savedPuzzles.filter((r) => r.id !== id));
          },
        },
      ]);
    },
    [persistPuzzles, savedPuzzles]
  );

  const goHome = useCallback(() => {
    setScreenMode('home');
    setReferenceOpen(false);
    setCompletionOpen(false);
    setHintOn(false);
    setIsTrayPieceDragging(false);
    setDragPreview(null);

    dragPreviewRef.current = null;

    resetBoardCamera();
  }, [resetBoardCamera]);

  const selectDifficulty = useCallback(
    (count) => {
      if (!pendingUri) return;

      const nextPieces = createPieces(pendingUri, count);
      const now = Date.now();

      let id = pendingPuzzleId;

      if (!id) {
        id = `puzzle-${now}`;

        persistPuzzles([
          {
            id,
            title: pendingPuzzleTitle,
            imageUri: pendingUri,
            createdAt: now,
            updatedAt: now,
            totalPieces: count,
            pieces: nextPieces,
            boardGroups: [],
            solvedCount: 0,
            progress: 0,
            completed: false,
          },
          ...savedPuzzles,
        ]);
      } else {
        updatePuzzleRecord(id, (r) => ({
          ...r,
          imageUri: pendingUri,
          totalPieces: count,
          pieces: nextPieces,
          boardGroups: [],
          solvedCount: 0,
          progress: 0,
          completed: false,
          updatedAt: now,
        }));
      }

      setActivePuzzleId(id);
      setSourceImage(pendingUri);
      setPieces(nextPieces);
      setBoardGroups([]);
      setSelectedPieceIds([]);
      setDifficultyOpen(false);
      setPendingUri(null);
      setPendingPuzzleId(null);
      setEdgeOnly(false);
      setHintOn(false);
      setSheetIndex(0);
      setDragPreview(null);
      setIsTrayPieceDragging(false);
      setCompletionOpen(false);

      completionShownRef.current = false;

      setScreenMode('puzzle');

      dragPreviewRef.current = null;
      dragPreviewPan.setValue({
        x: 0,
        y: 0,
      });

      resetBoardCamera();

      requestAnimationFrame(() => {
        sheetRef.current?.snapToIndex(0);
      });
    },
    [
      dragPreviewPan,
      pendingPuzzleId,
      pendingPuzzleTitle,
      pendingUri,
      persistPuzzles,
      resetBoardCamera,
      savedPuzzles,
      updatePuzzleRecord,
    ]
  );

  const openNewPuzzleFromCompletion = useCallback(() => {
    setCompletionOpen(false);
    setScreenMode('home');

    requestAnimationFrame(() => {
      pickFromGallery();
    });
  }, [pickFromGallery]);

  const snapToFrame = useCallback(
    (group) => {
      const target = frameSnapTarget(group, origin);

      if (!target) return group;

      return {
        ...group,
        x: target.targetX,
        y: target.targetY,
        anchoredToFrame: true,
      };
    },
    [origin]
  );

  const sendPiecesToBoard = useCallback(() => {
    const selected = selectedPieceIds.length
      ? visiblePieces.filter((p) => selectedPieceIds.includes(p.id))
      : visiblePieces.slice(0, SEND_COUNT);

    if (!selected.length) return;

    const ids = new Set(selected.map((p) => p.id));

    setBoardGroups((prev) => [
      ...prev,
      ...selected.map((p, i) => createGroup(p, i, origin, boardLayout)),
    ]);

    setPieces((prev) => prev.filter((p) => !ids.has(p.id)));

    setSelectedPieceIds((prev) => prev.filter((id) => !ids.has(id)));
  }, [boardLayout, origin, selectedPieceIds, visiblePieces]);

  const updateDragPreview = useCallback(
    (piece, screenPosition) => {
      const size = pieceSize(piece);
      const vs = visualSize(size);

      const pageX = screenPosition.x - vs / 2;
      const pageY = screenPosition.y - vs / 2;

      const had = Boolean(dragPreviewRef.current);

      dragPreviewRef.current = {
        piece,
        size,
        visualSize: vs,
        x: pageX,
        y: pageY,
      };

      dragPreviewPan.setValue({
        x: pageX - screenOffsetRef.current.x,
        y: pageY - screenOffsetRef.current.y,
      });

      if (!had) {
        setDragPreview({
          piece,
          size,
          visualSize: vs,
        });
      }
    },
    [dragPreviewPan]
  );

  const clearDragPreview = useCallback(() => {
    dragPreviewRef.current = null;

    dragPreviewPan.setValue({
      x: 0,
      y: 0,
    });

    setDragPreview(null);
    setIsTrayPieceDragging(false);
  }, [dragPreviewPan]);

  const sendOnePieceFromTrayToBoard = useCallback(
    (piece, screenPosition) => {
      const size = pieceSize(piece);
      const vs = visualSize(size);

      const fallback = {
        piece,
        size,
        visualSize: vs,
        x: screenPosition.x - vs / 2,
        y: screenPosition.y - vs / 2,
      };

      const final = dragPreviewRef.current || fallback;

      dragPreviewRef.current = null;
      setDragPreview(null);
      setIsTrayPieceDragging(false);

      const sheetHeight =
        typeof snapPoints[sheetIndex] === 'number'
          ? snapPoints[sheetIndex]
          : height * 0.2;

      if (final.y + final.visualSize / 2 >= height - sheetHeight) {
        return;
      }

      const visualBoardX = final.x - boardWindowLayout.x;
      const visualBoardY = final.y - boardWindowLayout.y;

      const scale = Math.max(0.35, boardScaleRef.current || 1);
      const pan = boardPanRef.current || { x: 0, y: 0 };

      const cx = boardLayout.width / 2;
      const cy = boardLayout.height / 2;

      const rawX = (visualBoardX - pan.x - cx * (1 - scale)) / scale;
      const rawY = (visualBoardY - pan.y - cy * (1 - scale)) / scale;

      const fallbackX = origin.x + Math.min(piece.col, 2) * (size * 0.28);
const fallbackY = origin.y + Math.min(piece.row, 2) * (size * 0.28);

const isBadDrop =
  rawX <= BOARD_PADDING + 4 ||
  rawY <= BOARD_PADDING + 4 ||
  rawX >= boardLayout.width - vs - BOARD_PADDING - 4 ||
  rawY >= boardLayout.height - vs - BOARD_PADDING - 4;

const custom = {
  x: clamp(
    isBadDrop ? fallbackX : rawX,
    BOARD_PADDING,
    Math.max(BOARD_PADDING, boardLayout.width - vs - BOARD_PADDING)
  ),
  y: clamp(
    isBadDrop ? fallbackY : rawY,
    BOARD_PADDING,
    Math.max(BOARD_PADDING, boardLayout.height - vs - BOARD_PADDING)
  ),
};

      const newGroup = snapToFrame(createGroup(piece, 0, origin, boardLayout, custom));

      setBoardGroups((prev) => [...prev, newGroup]);
      setPieces((prev) => prev.filter((p) => p.id !== piece.id));
      setSelectedPieceIds((prev) => prev.filter((id) => id !== piece.id));
    },
    [boardLayout, boardWindowLayout, origin, sheetIndex, snapPoints, snapToFrame]
  );

  const clearLooseSinglePieces = useCallback(() => {
    const loose = boardGroups.filter(
      (g) => !g.anchoredToFrame && g.pieces.length === 1
    );

    if (!loose.length) return;

    const returning = loose.map((g) => {
      const { relX, relY, ...clean } = g.pieces[0];
      return clean;
    });

    setBoardGroups((prev) =>
      prev.filter((g) => g.anchoredToFrame || g.pieces.length > 1)
    );

    setPieces((prev) =>
      [...returning, ...prev].sort((a, b) => a.originalIndex - b.originalIndex)
    );

    setSelectedPieceIds([]);
  }, [boardGroups]);

  const toggleTrayPieceSelection = useCallback((id) => {
    setSelectedPieceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const onGroupMoveEnd = useCallback(
    (id, pos) => {
      let returned = pos;

      setBoardGroups((prev) => {
        const dragged = prev.find((g) => g.id === id);
        if (!dragged) return prev;

        const moved = {
          ...dragged,
          x: pos.x,
          y: pos.y,
        };

        const others = prev.filter((g) => g.id !== id);
        const snap = groupSnapTarget(moved, others);

        if (snap) {
          const merged = snapToFrame(
            mergeGroups(moved, snap.other, snap.targetX, snap.targetY)
          );

          returned = {
            x: merged.x,
            y: merged.y,
          };

          return [...others.filter((g) => g.id !== snap.other.id), merged];
        }

        const final = snapToFrame(moved);

        returned = {
          x: final.x,
          y: final.y,
        };

        return prev.map((g) => (g.id === id ? final : g));
      });

      return returned;
    },
    [snapToFrame]
  );

  const exitSelectionMode = useCallback(() => {
    setSelectedPieceIds([]);
    setSheetIndex(0);
    sheetRef.current?.snapToIndex(0);
  }, []);

  const collapseTray = useCallback(() => {
  setSelectedPieceIds([]);
  setSheetIndex(0);
  sheetRef.current?.snapToIndex(0);
}, []);

  const renderTrayPiece = useCallback(
    ({ item }) => (
      <TrayPieceItem
        item={item}
        isSelected={selectedPieceIds.includes(item.id)}
        isSelectionMode={isSelectionMode}
        trayVisualSize={trayVisualSize}
        trayPieceSize={trayPieceSize}
        onToggleSelect={toggleTrayPieceSelection}
        onDragToBoard={sendOnePieceFromTrayToBoard}
        onDragStart={(piece, p) => {
          setIsTrayPieceDragging(true);
          updateDragPreview(piece, p);
        }}
        onDragMove={updateDragPreview}
        onDragEnd={clearDragPreview}
      />
    ),
    [
      clearDragPreview,
      isSelectionMode,
      selectedPieceIds,
      sendOnePieceFromTrayToBoard,
      toggleTrayPieceSelection,
      trayPieceSize,
      trayVisualSize,
      updateDragPreview,
    ]
  );

  return (
  <SafeAreaView style={styles.safeRoot}>
    <View ref={containerRef} style={styles.container} onLayout={measureContainer}>
      {screenMode === 'home' ? (
        <ScrollView
          style={styles.homeScroll}
          contentContainerStyle={styles.homeContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.homeHero}>
            <Text style={styles.homeEyebrow}>PUZZLE STUDIO</Text>
            <Text style={styles.homeTitle}>Puzzle'larım</Text>

            <Text style={styles.homeSubtitle}>
              Galeriden görsel ekle, parça sayısını seç ve kaldığın yerden devam et.
            </Text>

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.homePrimaryButton}
              onPress={pickFromGallery}
            >
              <Text style={styles.homePrimaryButtonText}>
                + Galeriden Yeni Puzzle
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Hazır görseller</Text>

          <View style={styles.homePresetRow}>
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.9}
                style={styles.homePresetCard}
                onPress={() => createPuzzleCard(p.uri, p.label)}
              >
                <Image source={{ uri: p.uri }} style={styles.homePresetImage} />
                <Text style={styles.homePresetLabel}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Kayıtlı puzzle'lar</Text>
            <Text style={styles.sectionCount}>{sortedSaved.length}</Text>
          </View>

          {homeLoading && <Text style={styles.emptyText}>Kayıtlar yükleniyor...</Text>}

          {!homeLoading && sortedSaved.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Henüz kayıt yok</Text>
              <Text style={styles.emptyText}>
                Bir görsel ekleyince burada kart olarak duracak.
              </Text>
            </View>
          )}

          <View style={styles.puzzleCardGrid}>
            {sortedSaved.map((record) => {
              const progress = progressOf(record);

              return (
                <TouchableOpacity
                  key={record.id}
                  activeOpacity={0.92}
                  style={styles.puzzleCard}
                  onPress={() => openSavedPuzzle(record)}
                >
                  <Image
                    source={{ uri: record.imageUri }}
                    style={styles.puzzleCardImage}
                    resizeMode="cover"
                  />

                  <View style={styles.progressBubble}>
                    <Text style={styles.progressBubbleText}>%{progress}</Text>
                  </View>

                  <View style={styles.puzzleCardBody}>
                    <Text style={styles.puzzleCardTitle} numberOfLines={1}>
                      {record.title || 'Puzzle'}
                    </Text>

                    <Text style={styles.puzzleCardMeta}>
                      {record.totalPieces
                        ? `${record.totalPieces} parça`
                        : 'Parça seçilmedi'}{' '}
                      · {formatDate(record.updatedAt)}
                    </Text>

                    <View style={styles.cardProgressTrack}>
                      <View
                        style={[
                          styles.cardProgressFill,
                          {
                            width: `${progress}%`,
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.cardActionRow}>
                      <Text style={styles.cardActionText}>
                        {record.totalPieces ? 'Devam et' : 'Başlat'}
                      </Text>

                      <TouchableOpacity
                        hitSlop={10}
                        onPress={() => deletePuzzle(record.id)}
                      >
                        <Text style={styles.cardDeleteText}>Sil</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <>
          <View style={styles.gameTopBar}>
  <View style={styles.topBarSideLeft}>
    <TouchableOpacity
      activeOpacity={0.75}
      style={styles.topIconButton}
      onPress={goHome}
    >
      <TopBarIcon type="back" />
    </TouchableOpacity>

    <TouchableOpacity
      activeOpacity={0.75}
      style={[
        styles.topIconButton,
        looseSingleGroups.length === 0 && styles.topIconButtonDisabled,
      ]}
      disabled={looseSingleGroups.length === 0}
      onPress={clearLooseSinglePieces}
    >
      <TopBarIcon
        type="broom"
        disabled={looseSingleGroups.length === 0}
      />
    </TouchableOpacity>

    <TouchableOpacity
      activeOpacity={0.75}
      style={[
        styles.topIconButton,
        edgeOnly && styles.topIconButtonActiveSoft,
        !sourceImage && styles.topIconButtonDisabled,
      ]}
      disabled={!sourceImage}
      onPress={() => setEdgeOnly((p) => !p)}
    >
      <TopBarIcon
        type="reference"
        active={edgeOnly}
        disabled={!sourceImage}
      />
    </TouchableOpacity>
  </View>

  <View pointerEvents="none" style={styles.topScoreAbsolute}>
    <Text style={styles.topScoreText}>{currentProgress}</Text>
  </View>

  <View style={styles.topBarSideRight}>
    <TouchableOpacity
      activeOpacity={0.75}
      style={[
        styles.topIconButton,
        hintOn && styles.topIconButtonActiveSoft,
        !sourceImage && styles.topIconButtonDisabled,
      ]}
      disabled={!sourceImage}
      onPress={() => setHintOn((p) => !p)}
    >
      <TopBarIcon
        type="edge"
        active={hintOn}
        disabled={!sourceImage}
      />
    </TouchableOpacity>

    <TouchableOpacity
      activeOpacity={0.75}
      style={[
        styles.topIconButton,
        referenceOpen && styles.topIconButtonActiveSoft,
        !sourceImage && styles.topIconButtonDisabled,
      ]}
      disabled={!sourceImage}
      onPress={() => setReferenceOpen((p) => !p)}
    >
      <TopBarIcon
        type="eye"
        active={referenceOpen}
        disabled={!sourceImage}
      />
    </TouchableOpacity>
  </View>
</View>

          <View
            ref={boardRef}
            {...boardPanResponder.panHandlers}
            style={styles.board}
            onLayout={(e) => {
              setBoardLayout(e.nativeEvent.layout);
              measureBoard();
            }}
          >
            <Animated.View
              style={[
                styles.boardCanvas,
                {
                  width: boardLayout.width,
                  height: boardLayout.height,
                  transform: [
                    { translateX: boardPan.x },
                    { translateY: boardPan.y },
                    { scale: boardScale },
                  ],
                },
              ]}
            >
              {!sourceImage && (
                <Text style={styles.boardLabel}>Başlamak için görsel seç</Text>
              )}

              {sourceImage && activePiece && (
                <View
                  pointerEvents="none"
                  style={[
                    styles.frameArea,
                    {
                      left: origin.x,
                      top: origin.y,
                      width: referenceWidth,
                      height: referenceHeight,
                    },
                  ]}
                />
              )}

              {sourceImage && activePiece && hintOn && (
                <Image
                  pointerEvents="none"
                  source={{ uri: sourceImage }}
                  style={[
                    styles.boardReferenceImage,
                    {
                      left: origin.x,
                      top: origin.y,
                      width: referenceWidth,
                      height: referenceHeight,
                    },
                  ]}
                  resizeMode="cover"
                />
              )}

              {sourceImage && boardGroups.length === 0 && (
                <Text style={styles.boardLabel}>Alt tepsiden parça gönder</Text>
              )}

              {orderedGroups.map((g) => (
                <DraggableGroup
                  key={g.id}
                  group={g}
                  onMoveEnd={onGroupMoveEnd}
                  getBoardScale={getBoardScale}
                />
              ))}
            </Animated.View>

            {sourceImage && (
              <View pointerEvents="box-none" style={styles.boardToolLayer}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.boardMiniButton}
                  onPress={resetBoardCamera}
                >
                  <Text style={styles.boardMiniButtonText}>Zoom sıfırla</Text>
                </TouchableOpacity>

                <Text style={styles.boardGestureHint}>
  2 parmakla taşı
</Text>
              </View>
            )}
          </View>

          <BottomSheet
  ref={sheetRef}
  index={0}
  snapPoints={snapPoints}
  onChange={setSheetIndex}
  enableContentPanningGesture={!isTrayPieceDragging}
  enableHandlePanningGesture={!isTrayPieceDragging}
            style={styles.sheetLayer}
            backgroundStyle={styles.sheetBg}
            handleIndicatorStyle={[
              styles.indicator,
              isTrayPieceDragging && styles.indicatorDisabled,
            ]}
          >
            <View style={styles.trayHeader}>
              <View>
                <Text selectable={false} style={styles.trayTitle}>
                  Parçalar ({visiblePieces.length})
                </Text>

                <Text selectable={false} style={styles.trayModeText}>
                  {isSelectionMode ? 'Seçim modu açık' : 'Sürükle-bırak modu'}
                </Text>
              </View>

              <View style={styles.trayActionRow}>
  {sheetIndex > 0 && (
    <TouchableOpacity style={styles.modeBtn} onPress={collapseTray}>
      <Text style={styles.modeBtnText}>Aşağı</Text>
    </TouchableOpacity>
  )}

  {isSelectionMode && (
    <TouchableOpacity style={styles.modeBtn} onPress={exitSelectionMode}>
      <Text style={styles.modeBtnText}>Sürükle</Text>
    </TouchableOpacity>
  )}

  <TouchableOpacity
    style={[
      styles.sendBtn,
      visiblePieces.length === 0 && styles.disabledBtn,
    ]}
    disabled={visiblePieces.length === 0}
    onPress={sendPiecesToBoard}
  >
    <Text style={styles.sendBtnText}>{sendButtonLabel}</Text>
  </TouchableOpacity>
</View>
            </View>

            <BottomSheetFlatList
              data={visiblePieces}
              keyExtractor={(item) => item.id}
              renderItem={renderTrayPiece}
              numColumns={TRAY_COLS}
              scrollEnabled={isSelectionMode}
              removeClippedSubviews={Platform.OS === 'android'}
              initialNumToRender={24}
              maxToRenderPerBatch={24}
              windowSize={7}
              updateCellsBatchingPeriod={32}
              contentContainerStyle={styles.pieceGrid}
            />

            {isSelectionMode && (
              <View pointerEvents="box-none" style={styles.trayFooter}>
                <TouchableOpacity
                  activeOpacity={0.92}
                  style={[
                    styles.traySendWide,
                    visiblePieces.length === 0 && styles.disabledBtn,
                  ]}
                  disabled={visiblePieces.length === 0}
                  onPress={sendPiecesToBoard}
                >
                  <Text style={styles.traySendWideText}>Send ({selectedCount})</Text>
                </TouchableOpacity>
              </View>
            )}
          </BottomSheet>

          {referenceOpen && sourceImage && (
            <FloatingReference
              uri={sourceImage}
              onClose={() => setReferenceOpen(false)}
            />
          )}

          {dragPreview && (
            <View pointerEvents="none" style={styles.dragPreviewLayer}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.dragPreviewPiece,
                  {
                    width: dragPreview.visualSize,
                    height: dragPreview.visualSize,
                    transform: dragPreviewPan.getTranslateTransform(),
                  },
                ]}
              >
                <PieceImage piece={dragPreview.piece} size={dragPreview.size} />
              </Animated.View>
            </View>
          )}
        </>
      )}

      <CompletionModal
        visible={completionOpen}
        progress={currentProgress}
        totalPieces={totalPieces}
        solvedCount={currentSolvedCount}
        onClose={() => setCompletionOpen(false)}
        onHome={goHome}
        onNewPuzzle={openNewPuzzleFromCompletion}
      />

      <Modal visible={difficultyOpen} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDifficultyOpen(false)}
        >
          <Pressable style={styles.modalBox}>
            <Text style={styles.modalTitle}>Kaç Parça Olsun?</Text>
            <Text style={styles.modalSubtitle}>{pendingPuzzleTitle}</Text>

            <View style={styles.difficultyRow}>
              {DIFFICULTIES.map((n) => (
                <TouchableOpacity
                  key={n}
                  style={styles.diffBtn}
                  onPress={() => selectDifficulty(n)}
                >
                  <Text style={styles.diffBtnText}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
        </View>
  </SafeAreaView>
);
}

const styles = StyleSheet.create({

  safeRoot: {
  flex: 1,
  backgroundColor: THEME.top,
},

  container: {
  flex: 1,
  backgroundColor: THEME.bg,
  userSelect: 'none',
},

  homeScroll: {
    flex: 1,
    backgroundColor: THEME.bg,
  },

  homeContent: {
  paddingHorizontal: 18,
  paddingTop: 14,
  paddingBottom: 36,
},

  homeHero: {
  backgroundColor: THEME.white,
  borderRadius: 22,
  padding: 20,
  marginTop: 0,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 3,
  },

  homeEyebrow: {
    color: THEME.purple,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 8,
  },

  homeTitle: {
    color: THEME.text,
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 8,
  },

  homeSubtitle: {
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },

  homePrimaryButton: {
    backgroundColor: THEME.purple,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },

  homePrimaryButtonText: {
    color: THEME.white,
    fontSize: 15,
    fontWeight: '900',
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
  },

  sectionTitle: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },

  sectionCount: {
    color: THEME.purple,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 12,
  },

  homePresetRow: {
    flexDirection: 'row',
    gap: 10,
  },

  homePresetCard: {
    flex: 1,
    backgroundColor: THEME.white,
    borderRadius: 18,
    padding: 8,
    borderWidth: 1,
    borderColor: '#ececec',
  },

  homePresetImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    marginBottom: 8,
  },

  homePresetLabel: {
    color: '#333',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },

  emptyBox: {
    backgroundColor: THEME.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#ececec',
  },

  emptyTitle: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },

  emptyText: {
    color: THEME.muted,
    fontSize: 13,
    lineHeight: 18,
  },

  puzzleCardGrid: {
    gap: 14,
  },

  puzzleCard: {
    backgroundColor: THEME.white,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e9e9e9',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 2,
  },

  puzzleCardImage: {
    width: '100%',
    height: Math.min(220, width * 0.52),
    backgroundColor: '#ddd',
  },

  progressBubble: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: THEME.purple,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: THEME.white,
  },

  progressBubbleText: {
    color: THEME.white,
    fontSize: 14,
    fontWeight: '900',
  },

  puzzleCardBody: {
    padding: 14,
  },

  puzzleCardTitle: {
    color: THEME.text,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4,
  },

  puzzleCardMeta: {
    color: THEME.muted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
  },

  cardProgressTrack: {
    height: 7,
    backgroundColor: '#ece8f7',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 12,
  },

  cardProgressFill: {
    height: '100%',
    backgroundColor: THEME.purple,
    borderRadius: 999,
  },

  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardActionText: {
    color: THEME.purple,
    fontSize: 13,
    fontWeight: '900',
  },

  cardDeleteText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '800',
  },

  gameTopBar: {
  height: 58,
  paddingHorizontal: 14,
  backgroundColor: THEME.top,
  borderBottomWidth: 1,
  borderBottomColor: THEME.topLine,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 6,
  elevation: 4,
  zIndex: 50,
},

topBarSideLeft: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: width > 700 ? 120 : 18,
},

topBarSideRight: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: width > 700 ? 120 : 18,
},

topScoreAbsolute: {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  alignItems: 'center',
  justifyContent: 'center',
},

  topIconButton: {
  width: 38,
  height: 38,
  borderRadius: 19,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'transparent',
},

  topIconButtonActive: {
    backgroundColor: '#f0e9ff',
  },

  topIconButtonActiveSoft: {
    backgroundColor: '#ececec',
  },

  topIconButtonDisabled: {
    opacity: 0.42,
  },


  topScoreText: {
    color: THEME.orange,
    fontSize: 20,
    fontWeight: '900',
    textShadowColor: '#00000020',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  topOrangeBadge: {
    position: 'absolute',
    right: 0,
    top: 1,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: THEME.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },

  topOrangeBadgeText: {
    color: THEME.white,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
  },

  board: {
  flex: 1,
  marginHorizontal: 10,
  marginTop: 10,
  marginBottom: 6,
  borderRadius: 0,
  backgroundColor: THEME.board,
  borderWidth: 1,
  borderColor: THEME.boardLine,
  overflow: 'hidden',
},

  boardCanvas: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'visible',
  },

  frameArea: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#d2d2d2',
    backgroundColor: '#e9e9e9',
    borderRadius: 0,
  },

  boardReferenceImage: {
    position: 'absolute',
    opacity: 0.38,
    borderRadius: 0,
  },

  boardLabel: {
    color: THEME.text,
    fontSize: 16,
    opacity: 0.35,
    textAlign: 'center',
    marginTop: 120,
  },

  boardGroup: {
    position: 'absolute',
    overflow: 'visible',
  },

  groupPiece: {
    position: 'absolute',
    overflow: 'visible',
  },

  boardToolLayer: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 10,
    zIndex: 1000,
    elevation: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  boardMiniButton: {
    backgroundColor: '#ffffffee',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },

  boardMiniButtonText: {
  color: '#333',
  fontSize: 10,
  fontWeight: '900',
},

  boardGestureHint: {
  color: '#555',
  fontSize: 10,
    fontWeight: '800',
    backgroundColor: '#ffffffcc',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },

  sheetLayer: {
    zIndex: 5,
    elevation: 5,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: -5 },
    shadowRadius: 14,
  },

  sheetBg: {
    backgroundColor: THEME.white,
    overflow: 'visible',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },

  indicator: {
    backgroundColor: '#cfcfcf',
    width: 42,
    height: 3,
  },

  indicatorDisabled: {
    opacity: 0.2,
  },

  trayHeader: {
    height: 64,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: THEME.white,
    userSelect: 'none',
  },

  trayTitle: {
    color: THEME.text,
    fontWeight: '900',
    fontSize: 15,
    userSelect: 'none',
  },

  trayModeText: {
    color: THEME.soft,
    fontSize: 11,
    marginTop: 2,
    fontWeight: '700',
    userSelect: 'none',
  },

  trayActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  modeBtn: {
    backgroundColor: '#f3f0fb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e3d9fb',
  },

  modeBtnText: {
    color: THEME.purple,
    fontSize: 12,
    fontWeight: '900',
  },

  sendBtn: {
    backgroundColor: THEME.purple,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },

  sendBtnText: {
    color: THEME.white,
    fontSize: 12,
    fontWeight: '900',
  },

  pieceGrid: {
  paddingHorizontal: 18,
  paddingTop: 14,
  paddingBottom: Platform.OS === 'android' ? 150 : 118,
  overflow: 'visible',
  backgroundColor: THEME.white,
},

  trayPiece: {
    margin: 6,
    overflow: 'visible',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },

  dragTrayPiece: {
    zIndex: 20,
    elevation: 20,
    overflow: 'visible',
  },

  trayPieceDragging: {
    opacity: 0.25,
  },

  selectedTrayPiece: {
    borderWidth: 2,
    borderColor: THEME.purple,
    borderRadius: 6,
    backgroundColor: THEME.white,
  },

  selectedBadge: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: THEME.purple2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedBadgeText: {
    color: THEME.white,
    fontSize: 14,
    fontWeight: '900',
  },

  trayFooter: {
    position: 'absolute',
    left: 34,
    right: 34,
    bottom: 28,
    zIndex: 100,
    elevation: 100,
  },

  traySendWide: {
    height: 66,
    borderRadius: 8,
    backgroundColor: THEME.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.purple,
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 5,
  },

  traySendWideText: {
    color: THEME.white,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  pieceImageBox: {
    overflow: 'visible',
    backgroundColor: 'transparent',
  },

  dragPreviewLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 999999,
    elevation: 999999,
  },

  dragPreviewPiece: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'visible',
    zIndex: 999999,
    elevation: 999999,
  },

  floatingReference: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: Math.min(width * 0.64, 330),
    aspectRatio: 1.18,
    backgroundColor: THEME.white,
    borderRadius: 8,
    padding: 6,
    zIndex: 9999,
    elevation: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
  },

  floatingReferenceImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#ddd',
  },

  floatingReferenceClose: {
    position: 'absolute',
    right: -8,
    top: -8,
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: THEME.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 4,
  },

  floatingReferenceCloseText: {
    color: THEME.black,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },

  disabledBtn: {
    opacity: 0.45,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000070',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalBox: {
    width: width * 0.9,
    backgroundColor: THEME.white,
    borderRadius: 16,
    padding: 18,
  },

  modalTitle: {
    color: THEME.text,
    fontWeight: '900',
    fontSize: 18,
    marginBottom: 14,
    textAlign: 'center',
  },

  modalSubtitle: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 14,
    fontWeight: '700',
  },

  difficultyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  diffBtn: {
    width: '48%',
    backgroundColor: THEME.purple,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },

  diffBtnText: {
    color: THEME.white,
    fontWeight: '900',
    fontSize: 18,
  },

  completionOverlay: {
    flex: 1,
    backgroundColor: '#00000088',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  confettiLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },

  confettiItem: {
    position: 'absolute',
    top: 0,
    fontWeight: '900',
  },

  completionCard: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: THEME.white,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee8ff',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 30,
    elevation: 10,
  },

  completionIconCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#f0e9ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  completionIcon: {
    fontSize: 38,
  },

  completionTitle: {
    color: THEME.text,
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 6,
  },

  completionSubtitle: {
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },

  completionStatsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 18,
  },

  completionStatBox: {
    flex: 1,
    backgroundColor: '#f7f4ff',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee8ff',
  },

  completionStatValue: {
    color: THEME.purple,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 2,
  },

  completionStatLabel: {
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '800',
  },

  completionPrimaryBtn: {
    width: '100%',
    backgroundColor: THEME.purple,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },

  completionPrimaryBtnText: {
    color: THEME.white,
    fontSize: 14,
    fontWeight: '900',
  },

  completionSecondaryBtn: {
    width: '100%',
    backgroundColor: '#f0e9ff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },

  completionSecondaryBtnText: {
    color: THEME.purple,
    fontSize: 14,
    fontWeight: '900',
  },

  completionGhostBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },

  completionGhostBtnText: {
    color: THEME.muted,
    fontSize: 13,
    fontWeight: '800',
  },
});