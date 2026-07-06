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
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Defs, ClipPath, Path, Image as SvgImage } from 'react-native-svg';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const STORAGE_KEY = 'PUZZLE_APP_SAVED_PUZZLES_V1';

const SELECT_MODE_INDEX = 2;
const TRAY_HEADER_SPACE = 76;

const TRAY_COLS = width > 1200 ? 8 : width > 700 ? 6 : 4;
const DIFFICULTIES = [36, 64, 100, 144, 196, 256];

const SEND_COUNT = 20;
const BOARD_PADDING = 16;
const TAB_RATIO = 0.2;

const FRAME_SNAP_THRESHOLD_MULTIPLIER = 0.85;
const GROUP_SNAP_THRESHOLD_MULTIPLIER = 0.42;

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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getTouchDistance(touches) {
  if (!touches || touches.length < 2) return 0;

  const [first, second] = touches;

  return Math.hypot(
    second.pageX - first.pageX,
    second.pageY - first.pageY
  );
}

function getTouchCenter(touches) {
  if (!touches || touches.length < 2) {
    return { x: 0, y: 0 };
  }

  const [first, second] = touches;

  return {
    x: (first.pageX + second.pageX) / 2,
    y: (first.pageY + second.pageY) / 2,
  };
}

function getGroupPieceCount(groups) {
  return groups.reduce((total, group) => total + group.pieces.length, 0);
}

function getSolvedPieceCount(groups) {
  return groups
    .filter((group) => group.anchoredToFrame)
    .reduce((total, group) => total + group.pieces.length, 0);
}

function getPuzzleProgress(record) {
  const totalPieces = record?.totalPieces || 0;
  if (!totalPieces) return 0;

  const solvedCount =
    typeof record.solvedCount === 'number'
      ? record.solvedCount
      : getSolvedPieceCount(record.boardGroups || []);

  return Math.min(100, Math.round((solvedCount / totalPieces) * 100));
}

function formatDate(timestamp) {
  if (!timestamp) return '';

  return new Date(timestamp).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
  });
}

function getBoardPieceSize(piece) {
  const cols = piece?.cols || 4;
  return Math.min(width > 900 ? 72 : 64, (width - 56) / cols);
}

function getPieceOverhang(size) {
  return size * TAB_RATIO;
}

function getVisualSize(size) {
  return size + getPieceOverhang(size) * 2;
}

function getFrameOrigin(piece, boardLayout) {
  if (!piece) {
    return {
      x: BOARD_PADDING,
      y: BOARD_PADDING,
    };
  }

  const size = getBoardPieceSize(piece);
  const frameWidth = size * piece.cols;
  const boardWidth = boardLayout?.width || width;

  return {
    x: Math.max(BOARD_PADDING, (boardWidth - frameWidth) / 2),
    y: BOARD_PADDING,
  };
}

function getSolvedPiecePosition(piece, frameOrigin) {
  const size = getBoardPieceSize(piece);
  const overhang = getPieceOverhang(size);

  return {
    x: frameOrigin.x + piece.col * size - overhang,
    y: frameOrigin.y + piece.row * size - overhang,
  };
}

function createPieces(uri, totalPieces) {
  const grid = Math.round(Math.sqrt(totalPieces));
  const createdAt = Date.now();

  return Array.from({ length: grid * grid }, (_, index) => {
    const row = Math.floor(index / grid);
    const col = index % grid;

    return {
      id: `${createdAt}-${index}`,
      originalIndex: index,
      uri,
      row,
      col,
      rows: grid,
      cols: grid,
      isEdge: row === 0 || col === 0 || row === grid - 1 || col === grid - 1,
    };
  });
}

function inverseEdge(edge) {
  if (edge === 'out') return 'in';
  if (edge === 'in') return 'out';
  return 'flat';
}

function verticalEdge(row, col) {
  return (row + col) % 2 === 0 ? 'out' : 'in';
}

function horizontalEdge(row, col) {
  return (row + col) % 2 === 0 ? 'out' : 'in';
}

function getPieceEdges(piece) {
  const top =
    piece.row === 0
      ? 'flat'
      : inverseEdge(horizontalEdge(piece.row - 1, piece.col));

  const right =
    piece.col === piece.cols - 1
      ? 'flat'
      : verticalEdge(piece.row, piece.col);

  const bottom =
    piece.row === piece.rows - 1
      ? 'flat'
      : horizontalEdge(piece.row, piece.col);

  const left =
    piece.col === 0
      ? 'flat'
      : inverseEdge(verticalEdge(piece.row, piece.col - 1));

  return { top, right, bottom, left };
}

function getJigsawPath(piece, size) {
  const overhang = getPieceOverhang(size);

  const x0 = overhang;
  const y0 = overhang;
  const x1 = overhang + size;
  const y1 = overhang + size;

  const midX = overhang + size / 2;
  const midY = overhang + size / 2;

  const neck = size * 0.1;
  const head = size * 0.18;
  const depth = size * 0.21;

  const edges = getPieceEdges(piece);

  let d = `M ${x0} ${y0}`;

  if (edges.top === 'flat') {
    d += ` L ${x1} ${y0}`;
  } else {
    const dir = edges.top === 'out' ? -1 : 1;

    d += `
      L ${midX - head} ${y0}
      C ${midX - head * 0.75} ${y0},
        ${midX - neck} ${y0 + dir * depth * 0.15},
        ${midX - neck} ${y0 + dir * depth * 0.45}
      C ${midX - neck} ${y0 + dir * depth},
        ${midX + neck} ${y0 + dir * depth},
        ${midX + neck} ${y0 + dir * depth * 0.45}
      C ${midX + neck} ${y0 + dir * depth * 0.15},
        ${midX + head * 0.75} ${y0},
        ${midX + head} ${y0}
      L ${x1} ${y0}
    `;
  }

  if (edges.right === 'flat') {
    d += ` L ${x1} ${y1}`;
  } else {
    const dir = edges.right === 'out' ? 1 : -1;

    d += `
      L ${x1} ${midY - head}
      C ${x1} ${midY - head * 0.75},
        ${x1 + dir * depth * 0.15} ${midY - neck},
        ${x1 + dir * depth * 0.45} ${midY - neck}
      C ${x1 + dir * depth} ${midY - neck},
        ${x1 + dir * depth} ${midY + neck},
        ${x1 + dir * depth * 0.45} ${midY + neck}
      C ${x1 + dir * depth * 0.15} ${midY + neck},
        ${x1} ${midY + head * 0.75},
        ${x1} ${midY + head}
      L ${x1} ${y1}
    `;
  }

  if (edges.bottom === 'flat') {
    d += ` L ${x0} ${y1}`;
  } else {
    const dir = edges.bottom === 'out' ? 1 : -1;

    d += `
      L ${midX + head} ${y1}
      C ${midX + head * 0.75} ${y1},
        ${midX + neck} ${y1 + dir * depth * 0.15},
        ${midX + neck} ${y1 + dir * depth * 0.45}
      C ${midX + neck} ${y1 + dir * depth},
        ${midX - neck} ${y1 + dir * depth},
        ${midX - neck} ${y1 + dir * depth * 0.45}
      C ${midX - neck} ${y1 + dir * depth * 0.15},
        ${midX - head * 0.75} ${y1},
        ${midX - head} ${y1}
      L ${x0} ${y1}
    `;
  }

  if (edges.left === 'flat') {
    d += ` L ${x0} ${y0}`;
  } else {
    const dir = edges.left === 'out' ? -1 : 1;

    d += `
      L ${x0} ${midY + head}
      C ${x0} ${midY + head * 0.75},
        ${x0 + dir * depth * 0.15} ${midY + neck},
        ${x0 + dir * depth * 0.45} ${midY + neck}
      C ${x0 + dir * depth} ${midY + neck},
        ${x0 + dir * depth} ${midY - neck},
        ${x0 + dir * depth * 0.45} ${midY - neck}
      C ${x0 + dir * depth * 0.15} ${midY - neck},
        ${x0} ${midY - head * 0.75},
        ${x0} ${midY - head}
      L ${x0} ${y0}
    `;
  }

  d += ' Z';

  return d;
}

const PieceImage = React.memo(function PieceImage({
  piece,
  size,
  highlightColor,
}) {
  const overhang = getPieceOverhang(size);
  const visualSize = getVisualSize(size);

  const path = useMemo(() => getJigsawPath(piece, size), [
    piece.id,
    piece.row,
    piece.col,
    piece.rows,
    piece.cols,
    size,
  ]);

  const clipId = useMemo(() => {
    const safeId = String(piece.id).replace(/[^a-zA-Z0-9_]/g, '_');
    return `clip_${safeId}_${Math.round(size * 1000)}`;
  }, [piece.id, size]);

  return (
    <View
      style={[
        styles.pieceImageBox,
        {
          width: visualSize,
          height: visualSize,
        },
      ]}
    >
      <Svg
        width={visualSize}
        height={visualSize}
        viewBox={`0 0 ${visualSize} ${visualSize}`}
      >
        <Defs>
          <ClipPath id={clipId}>
            <Path d={path} />
          </ClipPath>
        </Defs>

        <SvgImage
          href={{ uri: piece.uri }}
          x={overhang - piece.col * size}
          y={overhang - piece.row * size}
          width={size * piece.cols}
          height={size * piece.rows}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />

        {highlightColor ? (
          <Path d={path} fill="none" stroke={highlightColor} strokeWidth={1.1} />
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

function areAdjacentPieces(a, b) {
  const rowDiff = Math.abs(a.row - b.row);
  const colDiff = Math.abs(a.col - b.col);
  return rowDiff + colDiff === 1;
}

function createGroupFromPiece(
  piece,
  index,
  frameOrigin,
  boardLayout,
  customPosition
) {
  const size = getBoardPieceSize(piece);
  const visualSize = getVisualSize(size);
  const frameHeight = size * piece.rows;

  const defaultX = frameOrigin.x + (index % 4) * (visualSize + 14);
  const defaultY =
    frameOrigin.y + frameHeight + 34 + Math.floor(index / 4) * (visualSize + 14);

  const maxX = Math.max(
    BOARD_PADDING,
    (boardLayout?.width || width) - visualSize - BOARD_PADDING
  );

  const maxY = Math.max(
    BOARD_PADDING,
    (boardLayout?.height || 700) - visualSize - BOARD_PADDING
  );

  const rawX = customPosition?.x ?? defaultX;
  const rawY = customPosition?.y ?? defaultY;

  return {
    id: `group-${piece.id}-${Date.now()}`,
    x: Math.min(Math.max(rawX, BOARD_PADDING), maxX),
    y: Math.min(Math.max(rawY, BOARD_PADDING), maxY),
    pieces: [
      {
        ...piece,
        relX: 0,
        relY: 0,
      },
    ],
    anchoredToFrame: false,
  };
}

function getGroupBounds(group) {
  const piece = group.pieces[0];
  const size = getBoardPieceSize(piece);
  const visualSize = getVisualSize(size);

  let maxX = 0;
  let maxY = 0;

  group.pieces.forEach((p) => {
    maxX = Math.max(maxX, p.relX + visualSize);
    maxY = Math.max(maxY, p.relY + visualSize);
  });

  return {
    width: maxX,
    height: maxY,
  };
}

function findGroupSnapTarget(draggedGroup, otherGroups) {
  for (const otherGroup of otherGroups) {
    for (const draggedPiece of draggedGroup.pieces) {
      for (const otherPiece of otherGroup.pieces) {
        if (!areAdjacentPieces(draggedPiece, otherPiece)) continue;

        const size = getBoardPieceSize(draggedPiece);
        const threshold = Math.max(18, size * GROUP_SNAP_THRESHOLD_MULTIPLIER);

        const targetDraggedX =
          otherGroup.x +
          otherPiece.relX +
          (draggedPiece.col - otherPiece.col) * size -
          draggedPiece.relX;

        const targetDraggedY =
          otherGroup.y +
          otherPiece.relY +
          (draggedPiece.row - otherPiece.row) * size -
          draggedPiece.relY;

        const distanceX = Math.abs(draggedGroup.x - targetDraggedX);
        const distanceY = Math.abs(draggedGroup.y - targetDraggedY);

        if (distanceX <= threshold && distanceY <= threshold) {
          return {
            otherGroup,
            targetDraggedX,
            targetDraggedY,
          };
        }
      }
    }
  }

  return null;
}

function findFrameSnapTarget(group, frameOrigin) {
  for (const piece of group.pieces) {
    if (!piece.isEdge) continue;

    const solved = getSolvedPiecePosition(piece, frameOrigin);
    const size = getBoardPieceSize(piece);
    const threshold = Math.max(18, size * FRAME_SNAP_THRESHOLD_MULTIPLIER);

    const targetGroupX = solved.x - piece.relX;
    const targetGroupY = solved.y - piece.relY;

    const distanceX = Math.abs(group.x - targetGroupX);
    const distanceY = Math.abs(group.y - targetGroupY);

    if (distanceX <= threshold && distanceY <= threshold) {
      return {
        targetGroupX,
        targetGroupY,
      };
    }
  }

  return null;
}

function mergeGroups(draggedGroup, otherGroup, targetDraggedX, targetDraggedY) {
  const otherAbsPieces = otherGroup.pieces.map((piece) => ({
    ...piece,
    absX: otherGroup.x + piece.relX,
    absY: otherGroup.y + piece.relY,
  }));

  const draggedAbsPieces = draggedGroup.pieces.map((piece) => ({
    ...piece,
    absX: targetDraggedX + piece.relX,
    absY: targetDraggedY + piece.relY,
  }));

  const allPieces = [...otherAbsPieces, ...draggedAbsPieces];

  const originX = Math.min(...allPieces.map((piece) => piece.absX));
  const originY = Math.min(...allPieces.map((piece) => piece.absY));

  const normalizedPieces = allPieces.map((piece) => {
    const { absX, absY, ...rest } = piece;

    return {
      ...rest,
      relX: absX - originX,
      relY: absY - originY,
    };
  });

  return {
    id: `group-${Date.now()}-${normalizedPieces.length}`,
    x: originX,
    y: originY,
    pieces: normalizedPieces,
    anchoredToFrame: draggedGroup.anchoredToFrame || otherGroup.anchoredToFrame,
  };
}

const DraggableGroup = React.memo(function DraggableGroup({
  group,
  onMoveEnd,
  getBoardScale,
}) {
  const pan = useRef(
    new Animated.ValueXY({
      x: group.x,
      y: group.y,
    })
  ).current;

  const bounds = getGroupBounds(group);

  const layerZIndex = group.anchoredToFrame
    ? 10
    : group.pieces.length > 1
      ? 20
      : 30;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !group.anchoredToFrame,
        onMoveShouldSetPanResponder: () => !group.anchoredToFrame,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,

        onPanResponderGrant: () => {
          if (group.anchoredToFrame) return;

          pan.setValue({
            x: group.x,
            y: group.y,
          });
        },

        onPanResponderMove: (_event, gesture) => {
          if (group.anchoredToFrame) return;

          const scale = Math.max(0.35, getBoardScale?.() || 1);

          pan.setValue({
            x: group.x + gesture.dx / scale,
            y: group.y + gesture.dy / scale,
          });
        },

        onPanResponderRelease: () => {
          if (group.anchoredToFrame) return;

          const finalPosition = {
            x: pan.x._value,
            y: pan.y._value,
          };

          const nextPosition = onMoveEnd(group.id, finalPosition);

          if (nextPosition) {
            pan.setValue({
              x: nextPosition.x,
              y: nextPosition.y,
            });
          }
        },

        onPanResponderTerminate: () => {
          pan.setValue({
            x: group.x,
            y: group.y,
          });
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
      {...panResponder.panHandlers}
      style={[
        styles.boardGroup,
        {
          width: bounds.width,
          height: bounds.height,
          zIndex: layerZIndex,
          elevation: layerZIndex,
          transform: pan.getTranslateTransform(),
        },
      ]}
    >
      {group.pieces.map((piece) => {
        const size = getBoardPieceSize(piece);
        const visualSize = getVisualSize(size);

        return (
          <View
            key={piece.id}
            style={[
              styles.groupPiece,
              {
                left: piece.relX,
                top: piece.relY,
                width: visualSize,
                height: visualSize,
              },
            ]}
          >
            <PieceImage piece={piece} size={size} />
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
  const [isDragging, setIsDragging] = useState(false);

  const panResponder = useMemo(
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

          setIsDragging(true);

          onDragStart?.(item, {
            x: pageX,
            y: pageY,
          });
        },

        onPanResponderMove: (event, gesture) => {
          if (isSelectionMode) return;

          const pageX = event.nativeEvent.pageX ?? gesture.moveX;
          const pageY = event.nativeEvent.pageY ?? gesture.moveY;

          onDragMove?.(item, {
            x: pageX,
            y: pageY,
          });
        },

        onPanResponderRelease: (event, gesture) => {
          if (isSelectionMode) return;

          const pageX = event.nativeEvent.pageX ?? gesture.moveX;
          const pageY = event.nativeEvent.pageY ?? gesture.moveY;

          setIsDragging(false);

          onDragToBoard(item, {
            x: pageX,
            y: pageY,
          });

          requestAnimationFrame(() => {
            onDragEnd?.();
          });
        },

        onPanResponderTerminate: () => {
          setIsDragging(false);
          onDragEnd?.();
        },
      }),
    [
      isSelectionMode,
      item,
      onDragToBoard,
      onDragStart,
      onDragMove,
      onDragEnd,
    ]
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
          highlightColor={isSelected ? '#BFA2FF' : undefined}
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
      {...panResponder.panHandlers}
      style={[
        styles.trayPiece,
        styles.dragTrayPiece,
        isDragging && styles.trayPieceDragging,
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
      x: width * 0.16,
      y: 110,
    })
  ).current;

  const refScale = useRef(new Animated.Value(1)).current;

  const refGesture = useRef({
    startX: width * 0.16,
    startY: 110,
    startScale: 1,
    lastX: width * 0.16,
    lastY: 110,
    lastScale: 1,
    startDistance: 0,
  }).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (event) => {
          const touches = event.nativeEvent.touches || [];

          refGesture.startX = refGesture.lastX;
          refGesture.startY = refGesture.lastY;
          refGesture.startScale = refGesture.lastScale;

          if (touches.length >= 2) {
            refGesture.startDistance = getTouchDistance(touches);
          }
        },

        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches || [];

          if (touches.length >= 2) {
            const distance = getTouchDistance(touches);
            const ratio =
              refGesture.startDistance > 0
                ? distance / refGesture.startDistance
                : 1;

            const nextScale = clamp(refGesture.startScale * ratio, 0.55, 2.4);

            refGesture.lastScale = nextScale;
            refScale.setValue(nextScale);
            return;
          }

          const nextX = refGesture.startX + gesture.dx;
          const nextY = refGesture.startY + gesture.dy;

          refGesture.lastX = nextX;
          refGesture.lastY = nextY;

          refPan.setValue({
            x: nextX,
            y: nextY,
          });
        },

        onPanResponderRelease: () => {
          refGesture.startX = refGesture.lastX;
          refGesture.startY = refGesture.lastY;
          refGesture.startScale = refGesture.lastScale;
        },

        onPanResponderTerminate: () => {
          refGesture.startX = refGesture.lastX;
          refGesture.startY = refGesture.lastY;
          refGesture.startScale = refGesture.lastScale;
        },
      }),
    [refGesture, refPan, refScale]
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.floatingReference,
        {
          transform: [
            ...refPan.getTranslateTransform(),
            {
              scale: refScale,
            },
          ],
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

      <View pointerEvents="none" style={styles.floatingReferenceHint}>
        <Text style={styles.floatingReferenceHintText}>Sürükle / pinch</Text>
      </View>
    </Animated.View>
  );
});

export default function PuzzleScreen() {
  const sheetRef = useRef(null);
  const boardRef = useRef(null);
  const containerRef = useRef(null);

const screenOffsetRef = useRef({ x: 0, y: 0 });
const dragPreviewRef = useRef(null);
const saveTimerRef = useRef(null);

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

  const [presetOpen, setPresetOpen] = useState(false);
  const [difficultyOpen, setDifficultyOpen] = useState(false);
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
  const activePieceSize = getBoardPieceSize(activePiece);
  const frameOrigin = getFrameOrigin(activePiece, boardLayout);

  const trayCellSize = (width - 48) / TRAY_COLS;
  const trayPieceSize = trayCellSize / (1 + TAB_RATIO * 2);
  const trayVisualSize = getVisualSize(trayPieceSize);

  const snapPoints = useMemo(() => {
    const oneRowHeight = TRAY_HEADER_SPACE + trayVisualSize + 18;
    const twoRowHeight = TRAY_HEADER_SPACE + trayVisualSize * 2 + 32;
    const fullHeight = height * 0.84;

    return [
      Math.min(oneRowHeight, height * 0.48),
      Math.min(twoRowHeight, height * 0.72),
      fullHeight,
    ];
  }, [trayVisualSize]);

  const visiblePieces = useMemo(() => {
    if (!edgeOnly) return pieces;
    return pieces.filter((piece) => piece.isEdge);
  }, [pieces, edgeOnly]);

  const anchoredGroups = useMemo(
    () => boardGroups.filter((group) => group.anchoredToFrame),
    [boardGroups]
  );

  const connectedGroups = useMemo(
    () =>
      boardGroups.filter(
        (group) => !group.anchoredToFrame && group.pieces.length > 1
      ),
    [boardGroups]
  );

  const looseSingleGroups = useMemo(
    () =>
      boardGroups.filter(
        (group) => !group.anchoredToFrame && group.pieces.length === 1
      ),
    [boardGroups]
  );

  const orderedBoardGroups = useMemo(
    () => [...anchoredGroups, ...connectedGroups, ...looseSingleGroups],
    [anchoredGroups, connectedGroups, looseSingleGroups]
  );

  const selectedCount = selectedPieceIds.length;
  const sendCountLabel = Math.min(SEND_COUNT, visiblePieces.length);

  const sendButtonLabel =
    selectedCount > 0
      ? `Seçilenleri Gönder (${selectedCount})`
      : `${sendCountLabel} Parça Gönder`;

  const currentTotalPieces = pieces.length + getGroupPieceCount(boardGroups);
  const referenceWidth = activePiece ? activePieceSize * activePiece.cols : 0;
  const referenceHeight = activePiece ? activePieceSize * activePiece.rows : 0;

  const sortedSavedPuzzles = useMemo(
    () => [...savedPuzzles].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    [savedPuzzles]
  );

  useEffect(() => {
    let mounted = true;

    const loadSavedPuzzles = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];

        if (mounted && Array.isArray(parsed)) {
          setSavedPuzzles(parsed);
        }
      } catch (error) {
        console.log('Puzzle storage load error:', error);
      } finally {
        if (mounted) {
          setHomeLoading(false);
        }
      }
    };

    loadSavedPuzzles();

    return () => {
      mounted = false;
    };
  }, []);

  const persistPuzzles = useCallback((nextPuzzles) => {
    setSavedPuzzles(nextPuzzles);

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextPuzzles)).catch(
      (error) => {
        console.log('Puzzle storage save error:', error);
      }
    );
  }, []);

  const updatePuzzleRecord = useCallback((puzzleId, updater) => {
    setSavedPuzzles((prev) => {
      const next = prev.map((record) =>
        record.id === puzzleId ? updater(record) : record
      );

      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((error) => {
        console.log('Puzzle storage save error:', error);
      });

      return next;
    });
  }, []);

  useEffect(() => {
    if (
      screenMode !== 'puzzle' ||
      !activePuzzleId ||
      !sourceImage ||
      currentTotalPieces === 0
    ) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      const solvedCount = getSolvedPieceCount(boardGroups);
      const progress = Math.min(
        100,
        Math.round((solvedCount / currentTotalPieces) * 100)
      );

      updatePuzzleRecord(activePuzzleId, (record) => ({
        ...record,
        imageUri: sourceImage,
        totalPieces: currentTotalPieces,
        pieces,
        boardGroups,
        solvedCount,
        progress,
        completed: progress >= 100,
        updatedAt: Date.now(),
      }));
    }, 450);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [
    activePuzzleId,
    boardGroups,
    currentTotalPieces,
    pieces,
    screenMode,
    sourceImage,
    updatePuzzleRecord,
  ]);

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
      boardRef.current?.measure(
        (_x, _y, measuredWidth, measuredHeight, pageX, pageY) => {
          setBoardWindowLayout({
            x: pageX || 0,
            y: pageY || 0,
            width: measuredWidth,
            height: measuredHeight,
          });
        }
      );
    });
  }, []);

  const getBoardScale = useCallback(() => boardScaleRef.current, []);

const resetBoardCamera = useCallback(() => {
  boardScaleRef.current = 1;
  boardPanRef.current = { x: 0, y: 0 };

  boardScale.setValue(1);
  boardPan.setValue({ x: 0, y: 0 });
}, [boardPan, boardScale]);

const boardPanResponder = useMemo(
  () =>
    PanResponder.create({
      onStartShouldSetPanResponder: (event) =>
        (event.nativeEvent.touches || []).length >= 2,
      onMoveShouldSetPanResponder: (event) =>
        (event.nativeEvent.touches || []).length >= 2,
      onStartShouldSetPanResponderCapture: (event) =>
        (event.nativeEvent.touches || []).length >= 2,
      onMoveShouldSetPanResponderCapture: (event) =>
        (event.nativeEvent.touches || []).length >= 2,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (event) => {
        const touches = event.nativeEvent.touches || [];
        const center = getTouchCenter(touches);

        boardGestureRef.current = {
          startScale: boardScaleRef.current,
          startPanX: boardPanRef.current.x,
          startPanY: boardPanRef.current.y,
          startDistance: getTouchDistance(touches),
          startCenterX: center.x,
          startCenterY: center.y,
        };
      },

      onPanResponderMove: (event) => {
        const touches = event.nativeEvent.touches || [];
        if (touches.length < 2) return;

        const distance = getTouchDistance(touches);
        const center = getTouchCenter(touches);
        const gesture = boardGestureRef.current;

        const ratio =
          gesture.startDistance > 0
            ? distance / gesture.startDistance
            : 1;

        const nextScale = clamp(gesture.startScale * ratio, 0.65, 3.2);
        const nextPanX = gesture.startPanX + (center.x - gesture.startCenterX);
        const nextPanY = gesture.startPanY + (center.y - gesture.startCenterY);

        boardScaleRef.current = nextScale;
        boardPanRef.current = {
          x: nextPanX,
          y: nextPanY,
        };

        boardScale.setValue(nextScale);
        boardPan.setValue({
          x: nextPanX,
          y: nextPanY,
        });
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

  const queuePuzzleDifficulty = useCallback((record) => {
    setPendingUri(record.imageUri);
    setPendingPuzzleId(record.id);
    setPendingPuzzleTitle(record.title || 'Yeni Puzzle');
    setPresetOpen(false);
    setDifficultyOpen(true);
  }, []);

  const createPuzzleCardFromImage = useCallback(
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

      const next = [record, ...savedPuzzles];
      persistPuzzles(next);
      queuePuzzleDifficulty(record);
    },
    [persistPuzzles, queuePuzzleDifficulty, savedPuzzles]
  );

  const applyImage = useCallback(
    (uri, title = 'Yeni Puzzle') => {
      createPuzzleCardFromImage(uri, title);
    },
    [createPuzzleCardFromImage]
  );

  const openSavedPuzzle = useCallback(
    (record) => {
      if (!record.totalPieces) {
        queuePuzzleDifficulty(record);
        return;
      }

      const restoredPieces =
        Array.isArray(record.pieces) && record.pieces.length > 0
          ? record.pieces
          : createPieces(record.imageUri, record.totalPieces);

      setActivePuzzleId(record.id);
      setSourceImage(record.imageUri);
      setPieces(restoredPieces);
      setBoardGroups(Array.isArray(record.boardGroups) ? record.boardGroups : []);
      setSelectedPieceIds([]);
      setEdgeOnly(false);
      setHintOn(false);
      setSheetIndex(0);
      setDragPreview(null);
      setIsTrayPieceDragging(false);
      setScreenMode('puzzle');

      dragPreviewRef.current = null;
      dragPreviewPan.setValue({ x: 0, y: 0 });
      resetBoardCamera();

      requestAnimationFrame(() => {
        sheetRef.current?.snapToIndex(0);
      });
    },
    [dragPreviewPan, queuePuzzleDifficulty, resetBoardCamera]
  );

  const deletePuzzle = useCallback(
    (recordId) => {
      Alert.alert('Puzzle silinsin mi?', 'Bu kayıt ana sayfadan kaldırılacak.', [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            const next = savedPuzzles.filter((record) => record.id !== recordId);
            persistPuzzles(next);

            if (activePuzzleId === recordId) {
              setActivePuzzleId(null);
              setScreenMode('home');
            }
          },
        },
      ]);
    },
    [activePuzzleId, persistPuzzles, savedPuzzles]
  );

  const goHome = useCallback(() => {
  setScreenMode('home');
  setReferenceOpen(false);
  setHintOn(false);
  setIsTrayPieceDragging(false);
  setDragPreview(null);
  dragPreviewRef.current = null;
  resetBoardCamera();
}, [resetBoardCamera]);

  const selectDifficulty = useCallback(
    (totalPieces) => {
      if (!pendingUri) return;

      const nextPieces = createPieces(pendingUri, totalPieces);
      const now = Date.now();
      let targetId = pendingPuzzleId;

      if (!targetId) {
        targetId = `puzzle-${now}`;
        const record = {
          id: targetId,
          title: pendingPuzzleTitle || 'Yeni Puzzle',
          imageUri: pendingUri,
          createdAt: now,
          updatedAt: now,
          totalPieces,
          pieces: nextPieces,
          boardGroups: [],
          solvedCount: 0,
          progress: 0,
          completed: false,
        };

        persistPuzzles([record, ...savedPuzzles]);
      } else {
        updatePuzzleRecord(targetId, (record) => ({
          ...record,
          title: record.title || pendingPuzzleTitle || 'Yeni Puzzle',
          imageUri: pendingUri,
          totalPieces,
          pieces: nextPieces,
          boardGroups: [],
          solvedCount: 0,
          progress: 0,
          completed: false,
          updatedAt: now,
        }));
      }

      setActivePuzzleId(targetId);
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
      setScreenMode('puzzle');

      dragPreviewRef.current = null;
      dragPreviewPan.setValue({ x: 0, y: 0 });
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
  savedPuzzles,
  resetBoardCamera,
  updatePuzzleRecord,
]
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

      const squareImage = await ImageManipulator.manipulateAsync(
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

      createPuzzleCardFromImage(squareImage.uri, 'Galeriden Puzzle');
    } catch (error) {
      console.log('Gallery pick error:', error);

      Alert.alert(
        'Görsel seçilemedi',
        'Telefonda galeri açıldı ama görsel işlenemedi. Farklı bir görsel dene veya uygulama izinlerini kontrol et.'
      );
    }
  }, [createPuzzleCardFromImage, normalizeAssetUri]);

  const maybeSnapGroupToFrame = useCallback(
    (group) => {
      const frameSnap = findFrameSnapTarget(group, frameOrigin);

      if (!frameSnap) return group;

      return {
        ...group,
        x: frameSnap.targetGroupX,
        y: frameSnap.targetGroupY,
        anchoredToFrame: true,
      };
    },
    [frameOrigin]
  );

  const sendPiecesToBoard = useCallback(() => {
    const selected =
      selectedPieceIds.length > 0
        ? visiblePieces.filter((piece) => selectedPieceIds.includes(piece.id))
        : visiblePieces.slice(0, SEND_COUNT);

    if (selected.length === 0) return;

    const selectedIds = new Set(selected.map((piece) => piece.id));

    const newGroups = selected.map((piece, index) =>
      createGroupFromPiece(piece, index, frameOrigin, boardLayout)
    );

    setBoardGroups((prev) => [...prev, ...newGroups]);
    setPieces((prev) => prev.filter((piece) => !selectedIds.has(piece.id)));
    setSelectedPieceIds((prev) =>
      prev.filter((pieceId) => !selectedIds.has(pieceId))
    );
  }, [selectedPieceIds, visiblePieces, frameOrigin, boardLayout]);

  const updateDragPreview = useCallback(
    (piece, screenPosition) => {
      const size = getBoardPieceSize(piece);
      const visualSize = getVisualSize(size);

      const pageX = screenPosition.x - visualSize / 2;
      const pageY = screenPosition.y - visualSize / 2;

      const localX = pageX - screenOffsetRef.current.x;
      const localY = pageY - screenOffsetRef.current.y;

      const hadPreview = Boolean(dragPreviewRef.current);

      dragPreviewRef.current = {
        piece,
        size,
        visualSize,
        x: pageX,
        y: pageY,
      };

      dragPreviewPan.setValue({
        x: localX,
        y: localY,
      });

      if (!hadPreview) {
        setDragPreview({
          piece,
          size,
          visualSize,
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
      const size = getBoardPieceSize(piece);
      const visualSize = getVisualSize(size);

      const fallbackPreview = {
        piece,
        size,
        visualSize,
        x: screenPosition.x - visualSize / 2,
        y: screenPosition.y - visualSize / 2,
      };

      const finalPreview = dragPreviewRef.current || fallbackPreview;

      dragPreviewRef.current = null;
      setDragPreview(null);
      setIsTrayPieceDragging(false);

      const currentSheetHeight =
        typeof snapPoints[sheetIndex] === 'number'
          ? snapPoints[sheetIndex]
          : height * 0.2;

      const sheetTopY = height - currentSheetHeight;
      const previewCenterY = finalPreview.y + finalPreview.visualSize / 2;
      const releasedInsideTray = previewCenterY >= sheetTopY;

      if (releasedInsideTray) {
        return;
      }

const visualBoardX = finalPreview.x - boardWindowLayout.x;
const visualBoardY = finalPreview.y - boardWindowLayout.y;

const currentScale = Math.max(0.35, boardScaleRef.current || 1);
const currentPan = boardPanRef.current || { x: 0, y: 0 };
const boardCenterX = boardLayout.width / 2;
const boardCenterY = boardLayout.height / 2;

const rawBoardX =
  (visualBoardX - currentPan.x - boardCenterX * (1 - currentScale)) /
  currentScale;

const rawBoardY =
  (visualBoardY - currentPan.y - boardCenterY * (1 - currentScale)) /
  currentScale;

      const maxX = Math.max(
        BOARD_PADDING,
        boardLayout.width - visualSize - BOARD_PADDING
      );

      const maxY = Math.max(
        BOARD_PADDING,
        boardLayout.height - visualSize - BOARD_PADDING
      );

      const customPosition = {
        x: Math.min(Math.max(rawBoardX, BOARD_PADDING), maxX),
        y: Math.min(Math.max(rawBoardY, BOARD_PADDING), maxY),
      };

      const rawGroup = createGroupFromPiece(
        piece,
        0,
        frameOrigin,
        boardLayout,
        customPosition
      );

      const newGroup = maybeSnapGroupToFrame(rawGroup);

      setBoardGroups((prev) => [...prev, newGroup]);
      setPieces((prev) => prev.filter((p) => p.id !== piece.id));
      setSelectedPieceIds((prev) => prev.filter((id) => id !== piece.id));
    },
    [
      boardLayout,
      boardWindowLayout,
      frameOrigin,
      maybeSnapGroupToFrame,
      sheetIndex,
      snapPoints,
    ]
  );

  const clearLooseSinglePieces = useCallback(() => {
    const looseGroups = boardGroups.filter(
      (group) => !group.anchoredToFrame && group.pieces.length === 1
    );

    if (looseGroups.length === 0) return;

    const returningPieces = looseGroups.map((group) => {
      const piece = group.pieces[0];
      const { relX, relY, ...cleanPiece } = piece;
      return cleanPiece;
    });

    setBoardGroups((prev) =>
      prev.filter((group) => group.anchoredToFrame || group.pieces.length > 1)
    );

    setPieces((prev) =>
      [...returningPieces, ...prev].sort(
        (a, b) => a.originalIndex - b.originalIndex
      )
    );

    setSelectedPieceIds([]);
  }, [boardGroups]);

  const toggleTrayPieceSelection = useCallback((pieceId) => {
    setSelectedPieceIds((prev) => {
      if (prev.includes(pieceId)) {
        return prev.filter((id) => id !== pieceId);
      }

      return [...prev, pieceId];
    });
  }, []);

  const onGroupMoveEnd = useCallback(
    (groupId, position) => {
      let returnedPosition = position;

      setBoardGroups((prevGroups) => {
        const draggedGroup = prevGroups.find((group) => group.id === groupId);
        if (!draggedGroup) return prevGroups;

        const movedGroup = {
          ...draggedGroup,
          x: position.x,
          y: position.y,
        };

        const otherGroups = prevGroups.filter((group) => group.id !== groupId);
        const groupSnapTarget = findGroupSnapTarget(movedGroup, otherGroups);

        if (groupSnapTarget) {
          const mergedGroup = mergeGroups(
            movedGroup,
            groupSnapTarget.otherGroup,
            groupSnapTarget.targetDraggedX,
            groupSnapTarget.targetDraggedY
          );

          const finalMergedGroup = maybeSnapGroupToFrame(mergedGroup);

          returnedPosition = {
            x: finalMergedGroup.x,
            y: finalMergedGroup.y,
          };

          return [
            ...otherGroups.filter(
              (group) => group.id !== groupSnapTarget.otherGroup.id
            ),
            finalMergedGroup,
          ];
        }

        const finalMovedGroup = maybeSnapGroupToFrame(movedGroup);

        returnedPosition = {
          x: finalMovedGroup.x,
          y: finalMovedGroup.y,
        };

        return prevGroups.map((group) =>
          group.id === groupId ? finalMovedGroup : group
        );
      });

      return returnedPosition;
    },
    [maybeSnapGroupToFrame]
  );

  const exitSelectionMode = useCallback(() => {
    setSelectedPieceIds([]);
    setSheetIndex(0);
    sheetRef.current?.snapToIndex(0);
  }, []);

  const renderTrayPiece = useCallback(
    ({ item }) => {
      const isSelected = selectedPieceIds.includes(item.id);

      return (
        <TrayPieceItem
          item={item}
          isSelected={isSelected}
          isSelectionMode={isSelectionMode}
          trayVisualSize={trayVisualSize}
          trayPieceSize={trayPieceSize}
          onToggleSelect={toggleTrayPieceSelection}
          onDragToBoard={sendOnePieceFromTrayToBoard}
          onDragStart={(piece, position) => {
            setIsTrayPieceDragging(true);
            updateDragPreview(piece, position);
          }}
          onDragMove={updateDragPreview}
          onDragEnd={clearDragPreview}
        />
      );
    },
    [
      selectedPieceIds,
      isSelectionMode,
      trayPieceSize,
      trayVisualSize,
      toggleTrayPieceSelection,
      sendOnePieceFromTrayToBoard,
      updateDragPreview,
      clearDragPreview,
    ]
  );

  return (
    <View
      ref={containerRef}
      style={styles.container}
      onLayout={measureContainer}
    >
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
            {PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                activeOpacity={0.9}
                style={styles.homePresetCard}
                onPress={() => applyImage(preset.uri, preset.label)}
              >
                <Image source={{ uri: preset.uri }} style={styles.homePresetImage} />
                <Text style={styles.homePresetLabel}>{preset.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Kayıtlı puzzle'lar</Text>
            <Text style={styles.sectionCount}>{sortedSavedPuzzles.length}</Text>
          </View>

          {homeLoading && (
            <Text style={styles.emptyText}>Kayıtlar yükleniyor...</Text>
          )}

          {!homeLoading && sortedSavedPuzzles.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Henüz kayıt yok</Text>
              <Text style={styles.emptyText}>
                Bir görsel ekleyince burada kart olarak duracak.
              </Text>
            </View>
          )}

          <View style={styles.puzzleCardGrid}>
            {sortedSavedPuzzles.map((record) => {
              const progress = getPuzzleProgress(record);
              const totalLabel = record.totalPieces
                ? `${record.totalPieces} parça`
                : 'Parça seçilmedi';

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
                      {totalLabel} · {formatDate(record.updatedAt)}
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
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerBtn} onPress={goHome}>
              <Text style={styles.headerBtnText}>← Ana Sayfa</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerBtn, !sourceImage && styles.disabledBtn]}
              disabled={!sourceImage}
onPress={() => setReferenceOpen((prev) => !prev)}            >
              <Text style={styles.headerBtnText}>
  {referenceOpen ? '✕ Referans' : '👁️ Referans'}
</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.headerBtn,
                hintOn && styles.headerBtnActive,
                !sourceImage && styles.disabledBtn,
              ]}
              disabled={!sourceImage}
              onPress={() => setHintOn((prev) => !prev)}
            >
              <Text style={styles.headerBtnText}>
                {hintOn ? '💡 İpucu Kapat' : '💡 İpucu'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerBtn, !sourceImage && styles.disabledBtn]}
              disabled={!sourceImage}
              onPress={() => setEdgeOnly((prev) => !prev)}
            >
              <Text style={styles.headerBtnText}>
                {edgeOnly ? 'Tüm Parçalar' : 'Kenarlar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.headerBtn,
                styles.cleanHeaderBtn,
                looseSingleGroups.length === 0 && styles.disabledBtn,
              ]}
              disabled={looseSingleGroups.length === 0}
              onPress={clearLooseSinglePieces}
            >
              <Text style={styles.headerBtnText}>🧹</Text>
            </TouchableOpacity>
          </View>

<View
  ref={boardRef}
  {...boardPanResponder.panHandlers}
  style={styles.board}
  onLayout={(event) => {
    setBoardLayout(event.nativeEvent.layout);
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
            left: frameOrigin.x,
            top: frameOrigin.y,
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
            left: frameOrigin.x,
            top: frameOrigin.y,
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

    {orderedBoardGroups.map((group) => (
      <DraggableGroup
        key={group.id}
        group={group}
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
        2 parmakla yakınlaştır / taşı
      </Text>
    </View>
  )}
</View>

          <BottomSheet
            ref={sheetRef}
            index={0}
            snapPoints={snapPoints}
            onChange={setSheetIndex}
            enableContentPanningGesture={false}
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

      <Modal visible={presetOpen} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPresetOpen(false)}
        >
          <Pressable style={styles.modalBox}>
            <Text style={styles.modalTitle}>Puzzle Görseli Seç</Text>

            <TouchableOpacity
              style={styles.gallerySelectBtn}
              onPress={pickFromGallery}
            >
              <Text style={styles.gallerySelectText}>+ Galeriden Seç</Text>
            </TouchableOpacity>

            <View style={styles.presetRow}>
              {PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={styles.presetCard}
                  onPress={() => applyImage(preset.uri, preset.label)}
                >
                  <Image
                    source={{ uri: preset.uri }}
                    style={styles.presetImage}
                  />
                  <Text style={styles.presetLabel}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={difficultyOpen} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDifficultyOpen(false)}
        >
          <Pressable style={styles.modalBox}>
            <Text style={styles.modalTitle}>Kaç Parça Olsun?</Text>
            <Text style={styles.modalSubtitle}>{pendingPuzzleTitle}</Text>

            <View style={styles.difficultyRow}>
              {DIFFICULTIES.map((number) => (
                <TouchableOpacity
                  key={number}
                  style={styles.diffBtn}
                  onPress={() => selectDifficulty(number)}
                >
                  <Text style={styles.diffBtnText}>{number}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 42,
    backgroundColor: '#f2f2f2',
    userSelect: 'none',
  },

  homeScroll: {
    flex: 1,
    backgroundColor: '#f2f2f2',
  },

  homeContent: {
    paddingHorizontal: 18,
    paddingBottom: 36,
  },

  homeHero: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginTop: 8,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#e7e2f4',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 3,
  },

  homeEyebrow: {
    color: '#7e57c2',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 8,
  },

  homeTitle: {
    color: '#202020',
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 8,
  },

  homeSubtitle: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },

  homePrimaryButton: {
    backgroundColor: '#6d4bb3',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },

  homePrimaryButtonText: {
    color: '#ffffff',
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
    color: '#202020',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },

  sectionCount: {
    color: '#7e57c2',
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
    backgroundColor: '#ffffff',
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
    color: '#333333',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },

  emptyBox: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#ececec',
  },

  emptyTitle: {
    color: '#222222',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },

  emptyText: {
    color: '#777777',
    fontSize: 13,
    lineHeight: 18,
  },

  puzzleCardGrid: {
    gap: 14,
  },

  puzzleCard: {
    backgroundColor: '#ffffff',
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
    backgroundColor: '#dddddd',
  },

  progressBubble: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#6d4bb3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },

  progressBubbleText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },

  puzzleCardBody: {
    padding: 14,
  },

  puzzleCardTitle: {
    color: '#202020',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4,
  },

  puzzleCardMeta: {
    color: '#777777',
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
    backgroundColor: '#7e57c2',
    borderRadius: 999,
  },

  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardActionText: {
    color: '#6d4bb3',
    fontSize: 13,
    fontWeight: '900',
  },

  cardDeleteText: {
    color: '#999999',
    fontSize: 12,
    fontWeight: '800',
  },

  header: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexWrap: 'wrap',
  },

  headerBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e3e3e3',
  },

  headerBtnActive: {
    backgroundColor: '#6d4bb3',
    borderColor: '#6d4bb3',
  },

  headerBtnText: {
    color: '#222222',
    fontWeight: '700',
    fontSize: 12,
  },

  cleanHeaderBtn: {
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
  },

  disabledBtn: {
    opacity: 0.45,
  },

  board: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#e6e6e6',
    borderWidth: 1,
    borderColor: '#d7d7d7',
    overflow: 'hidden',
  },

  boardCanvas: {
  position: 'absolute',
  left: 0,
  top: 0,
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
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderWidth: 1,
  borderColor: '#dedede',
},

boardMiniButtonText: {
  color: '#333333',
  fontSize: 11,
  fontWeight: '900',
},

boardGestureHint: {
  color: '#555555',
  fontSize: 10,
  fontWeight: '800',
  backgroundColor: '#ffffffbb',
  paddingHorizontal: 9,
  paddingVertical: 5,
  borderRadius: 999,
  overflow: 'hidden',
},

  frameArea: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#c7c7c7',
    backgroundColor: '#f7f7f7',
    borderRadius: 6,
  },

  boardReferenceImage: {
    position: 'absolute',
    opacity: 0.4,
    borderRadius: 8,
  },

  boardLabel: {
    color: '#222222',
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

  sheetLayer: {
    zIndex: 5,
    elevation: 5,
    overflow: 'visible',
  },

  sheetBg: {
    backgroundColor: '#ffffff',
    overflow: 'visible',
  },

  indicator: {
    backgroundColor: '#6d4bb3',
    width: 40,
  },

  indicatorDisabled: {
    opacity: 0.2,
  },

  trayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    userSelect: 'none',
  },

  trayTitle: {
    color: '#222222',
    fontWeight: '800',
    fontSize: 15,
    userSelect: 'none',
  },

  trayModeText: {
    color: '#777777',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
    userSelect: 'none',
  },

  trayActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  modeBtn: {
    backgroundColor: '#ffffff22',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },

  modeBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  sendBtn: {
    backgroundColor: '#6d4bb3',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },

  sendBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  pieceGrid: {
    paddingHorizontal: 8,
    paddingBottom: 80,
    overflow: 'visible',
  },

  trayPiece: {
    margin: 4,
    overflow: 'visible',
    backgroundColor: 'transparent',
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
    borderColor: '#BFA2FF',
    borderRadius: 10,
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

  selectedBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8E6AD8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000070',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalBox: {
    width: width * 0.9,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
  },

  modalTitle: {
    color: '#222222',
    fontWeight: '900',
    fontSize: 18,
    marginBottom: 14,
    textAlign: 'center',
  },

  modalSubtitle: {
    color: '#666666',
    fontSize: 13,
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 14,
    fontWeight: '700',
  },

  floatingReference: {
  position: 'absolute',
  left: 0,
  top: 0,
  width: Math.min(width * 0.72, 340),
  aspectRatio: 1,
  backgroundColor: '#ffffff',
  borderRadius: 14,
  padding: 6,
  zIndex: 9999,
  elevation: 9999,
  shadowColor: '#000',
  shadowOpacity: 0.2,
  shadowOffset: { width: 0, height: 8 },
  shadowRadius: 18,
},

floatingReferenceImage: {
  width: '100%',
  height: '100%',
  borderRadius: 10,
  backgroundColor: '#dddddd',
},

floatingReferenceClose: {
  position: 'absolute',
  right: -10,
  top: -10,
  width: 34,
  height: 34,
  borderRadius: 17,
  backgroundColor: '#ffffff',
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1,
  borderColor: '#dddddd',
  elevation: 3,
},

floatingReferenceCloseText: {
  color: '#222222',
  fontSize: 24,
  lineHeight: 26,
  fontWeight: '600',
},

floatingReferenceHint: {
  position: 'absolute',
  left: 10,
  bottom: 10,
  backgroundColor: '#00000060',
  borderRadius: 999,
  paddingHorizontal: 9,
  paddingVertical: 5,
},

floatingReferenceHintText: {
  color: '#ffffff',
  fontSize: 10,
  fontWeight: '800',
},

  gallerySelectBtn: {
    backgroundColor: '#6d4bb3',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },

  gallerySelectText: {
    color: '#fff',
    fontWeight: '900',
  },

  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  presetCard: {
    width: '31%',
    alignItems: 'center',
  },

  presetImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    marginBottom: 6,
  },

  presetLabel: {
    color: '#222222',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },

  difficultyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  diffBtn: {
    width: '48%',
    backgroundColor: '#6d4bb3',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },

  diffBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
  },

  referenceOverlay: {
    flex: 1,
    backgroundColor: '#000000dd',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  referenceImage: {
    width: '100%',
    height: '80%',
  },

  referenceText: {
    color: '#fff',
    marginTop: 14,
    opacity: 0.7,
  },
});