import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  updateDragPreview,
clearDragPreview,
} from 'react-native';

import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Defs, ClipPath, Path, Image as SvgImage } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const SELECT_MODE_INDEX = 2;
const TRAY_HEADER_SPACE = 76;

const TRAY_COLS = width > 1200 ? 8 : width > 700 ? 6 : 4;
const DIFFICULTIES = [16, 25, 36, 64];

const SEND_COUNT = 20;
const BOARD_PADDING = 16;
const TAB_RATIO = 0.2;
const FRAME_SNAP_THRESHOLD_MULTIPLIER = 0.42;
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

  return Array.from({ length: grid * grid }, (_, index) => {
    const row = Math.floor(index / grid);
    const col = index % grid;

    return {
      id: `${Date.now()}-${index}`,
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

function PieceImage({ piece, size, strokeColor = '#ffffff88' }) {
  const overhang = getPieceOverhang(size);
  const visualSize = getVisualSize(size);
  const path = getJigsawPath(piece, size);
  const clipId = `clip-${piece.id}`;

  return (
    <View style={[styles.pieceImageBox, { width: visualSize, height: visualSize }]}>
      <Svg width={visualSize} height={visualSize} viewBox={`0 0 ${visualSize} ${visualSize}`}>
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

        <Path d={path} fill="none" stroke={strokeColor} strokeWidth={0.75} />
      </Svg>
    </View>
  );
}

function areAdjacentPieces(a, b) {
  const rowDiff = Math.abs(a.row - b.row);
  const colDiff = Math.abs(a.col - b.col);
  return rowDiff + colDiff === 1;
}

function createGroupFromPiece(piece, index, frameOrigin, boardLayout, customPosition) {
  const size = getBoardPieceSize(piece);
  const visualSize = getVisualSize(size);
  const frameHeight = size * piece.rows;

  const defaultX = frameOrigin.x + (index % 4) * (visualSize + 14);
  const defaultY = frameOrigin.y + frameHeight + 34 + Math.floor(index / 4) * (visualSize + 14);

  const maxX = Math.max(BOARD_PADDING, (boardLayout?.width || width) - visualSize - BOARD_PADDING);
  const maxY = Math.max(BOARD_PADDING, (boardLayout?.height || 700) - visualSize - BOARD_PADDING);

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

function DraggableGroup({ group, onMoveEnd }) {
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
  onStartShouldSetPanResponder: () => !isSelectionMode,
  onStartShouldSetPanResponderCapture: () => !isSelectionMode,
  onMoveShouldSetPanResponder: () => !isSelectionMode,
  onMoveShouldSetPanResponderCapture: () => !isSelectionMode,
  onPanResponderTerminationRequest: () => false,
  onShouldBlockNativeResponder: () => true,

        onPanResponderGrant: () => {
          if (group.anchoredToFrame) return;

          pan.setOffset({
            x: pan.x._value,
            y: pan.y._value,
          });

          pan.setValue({
            x: 0,
            y: 0,
          });
        },

        onPanResponderMove: Animated.event(
          [null, { dx: pan.x, dy: pan.y }],
          { useNativeDriver: false }
        ),

        onPanResponderRelease: () => {
          if (group.anchoredToFrame) return;

          pan.flattenOffset();

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
      }),
    [group.id, group.anchoredToFrame, onMoveEnd, pan]
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
            <PieceImage
              piece={piece}
              size={size}
              strokeColor={group.anchoredToFrame ? '#7CFF8A' : '#ffffff88'}
            />

            {group.anchoredToFrame && (
              <View style={styles.lockedBadge}>
                <Text style={styles.lockedBadgeText}>✓</Text>
              </View>
            )}
          </View>
        );
      })}
    </Animated.View>
  );
}

function TrayPieceItem({
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
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
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

        onPanResponderGrant: (event) => {
          if (isSelectionMode) return;

          setIsDragging(true);

          onDragStart?.(item, {
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
          });
        },

        onPanResponderMove: (_, gesture) => {
          if (isSelectionMode) return;

          pan.setValue({
            x: gesture.dx,
            y: gesture.dy,
          });

          onDragMove?.(item, {
            x: gesture.moveX,
            y: gesture.moveY,
          });
        },

        onPanResponderRelease: (_, gesture) => {
  if (!isSelectionMode) {
    setIsDragging(false);

    pan.setValue({ x: 0, y: 0 });

    onDragToBoard(item, {
      x: gesture.moveX,
      y: gesture.moveY,
    });

    requestAnimationFrame(() => {
      onDragEnd?.();
    });
  }
},

        onPanResponderTerminate: () => {
          setIsDragging(false);
          onDragEnd?.();
          pan.setValue({ x: 0, y: 0 });
        },
      }),
    [
      isSelectionMode,
      item,
      onDragToBoard,
      onDragStart,
      onDragMove,
      onDragEnd,
      pan,
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
          strokeColor={isSelected ? '#BFA2FF' : '#ffffff88'}
        />

        {item.isEdge && (
          <View style={styles.edgeBadge}>
            <Text style={styles.edgeBadgeText}>K</Text>
          </View>
        )}

        {isSelected && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.trayPiece,
        styles.dragTrayPiece,
        isDragging && styles.trayPieceDragging,
        {
          width: trayVisualSize,
          height: trayVisualSize,
          transform: pan.getTranslateTransform(),
        },
      ]}
    >
      <PieceImage piece={item} size={trayPieceSize} />

      {item.isEdge && (
        <View style={styles.edgeBadge}>
          <Text style={styles.edgeBadgeText}>K</Text>
        </View>
      )}

      <View style={styles.dragHintBadge}>
        <Text style={styles.dragHintText}>↗</Text>
      </View>
    </Animated.View>
  );
}

export default function PuzzleScreen() {
  const sheetRef = useRef(null);

  const [sourceImage, setSourceImage] = useState(null);
  const [pieces, setPieces] = useState([]);
  const [boardGroups, setBoardGroups] = useState([]);

  const [presetOpen, setPresetOpen] = useState(false);
  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);

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

  const boardPieceCount = boardGroups.reduce(
    (total, group) => total + group.pieces.length,
    0
  );

  const referenceWidth = activePiece ? activePieceSize * activePiece.cols : 0;
  const referenceHeight = activePiece ? activePieceSize * activePiece.rows : 0;

  const applyImage = (uri) => {
    setPendingUri(uri);
    setPresetOpen(false);
    setDifficultyOpen(true);
  };

  const selectDifficulty = (totalPieces) => {
    const nextPieces = createPieces(pendingUri, totalPieces);

    setSourceImage(pendingUri);
    setPieces(nextPieces);
    setBoardGroups([]);
    setSelectedPieceIds([]);
    setDifficultyOpen(false);
    setEdgeOnly(false);
    setSheetIndex(0);
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      applyImage(result.assets[0].uri);
    }
  };

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

  const sendPiecesToBoard = () => {
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
  };

  const updateDragPreview = useCallback((piece, screenPosition) => {
  const size = getBoardPieceSize(piece);
  const visualSize = getVisualSize(size);

  setDragPreview({
    piece,
    size,
    visualSize,
    x: screenPosition.x - visualSize / 2,
    y: screenPosition.y - visualSize / 2,
  });
}, []);

const clearDragPreview = useCallback(() => {
  setDragPreview(null);
}, []);

  const sendOnePieceFromTrayToBoard = useCallback(
    (piece, screenPosition) => {
          setDragPreview(null);
    setIsTrayPieceDragging?.(false);
      const boardX = screenPosition.x - boardLayout.x;
      const boardY = screenPosition.y - boardLayout.y;

      const isInsideBoard =
        boardX >= 0 &&
        boardX <= boardLayout.width &&
        boardY >= 0 &&
        boardY <= boardLayout.height;

      const size = getBoardPieceSize(piece);
      const visualSize = getVisualSize(size);

      const customPosition = isInsideBoard
        ? {
            x: boardX - visualSize / 2,
            y: boardY - visualSize / 2,
          }
        : null;

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
    [boardLayout, frameOrigin, maybeSnapGroupToFrame]
  );

  const clearLooseSinglePieces = () => {
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
  };

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
  onDragStart={updateDragPreview}
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
    ]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setPresetOpen(true)}
        >
          <Text style={styles.headerBtnText}>🖼️ Galeri</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.headerBtn, !sourceImage && styles.disabledBtn]}
          disabled={!sourceImage}
          onPress={() => setReferenceOpen(true)}
        >
          <Text style={styles.headerBtnText}>👁️ Referans</Text>
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
        style={styles.board}
        onLayout={(event) => {
          setBoardLayout(event.nativeEvent.layout);
        }}
      >
        {!sourceImage && (
          <Text style={styles.boardLabel}>Başlamak için görsel seç</Text>
        )}

        {sourceImage && activePiece && (
          <>
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
          </>
        )}

        {sourceImage && boardGroups.length === 0 && (
          <Text style={styles.boardLabel}>Alt tepsiden parça gönder</Text>
        )}

        {sourceImage && boardGroups.length > 0 && (
          <View style={styles.progressBadge}>
            <Text style={styles.progressText}>
              Parça: {boardPieceCount} | Sabit: {anchoredGroups.length} | Grup:{' '}
              {connectedGroups.length} | Tekli: {looseSingleGroups.length}
            </Text>
          </View>
        )}

        {looseSingleGroups.length > 0 && (
          <TouchableOpacity
            style={styles.floatingCleanBtn}
            onPress={clearLooseSinglePieces}
          >
            <Text style={styles.floatingCleanText}>
              🧹 Teklileri Topla ({looseSingleGroups.length})
            </Text>
          </TouchableOpacity>
        )}

        {orderedBoardGroups.map((group) => (
          <DraggableGroup
            key={group.id}
            group={group}
            onMoveEnd={onGroupMoveEnd}
          />
        ))}
      </View>

      <BottomSheet
  ref={sheetRef}
  index={0}
  snapPoints={snapPoints}
  onChange={setSheetIndex}
  enableContentPanningGesture={false}
  enableHandlePanningGesture={!isTrayPieceDragging}
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
  {isSelectionMode
    ? 'Seçim modu açık'
    : 'Sürükle-bırak modu'}
</Text>
          </View>

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

        <BottomSheetFlatList
  data={visiblePieces}
  keyExtractor={(item) => item.id}
  renderItem={renderTrayPiece}
  numColumns={TRAY_COLS}
  scrollEnabled={isSelectionMode}
  removeClippedSubviews={false}
  contentContainerStyle={styles.pieceGrid}
/>
      </BottomSheet>

{dragPreview && (
  <View pointerEvents="none" style={styles.dragPreviewLayer}>
    <View
      pointerEvents="none"
      style={[
        styles.dragPreviewPiece,
        {
          left: dragPreview.x,
          top: dragPreview.y,
          width: dragPreview.visualSize,
          height: dragPreview.visualSize,
        },
      ]}
    >
      <PieceImage
        piece={dragPreview.piece}
        size={dragPreview.size}
        strokeColor="#ffffff"
      />
    </View>
  </View>
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
                  onPress={() => applyImage(preset.uri)}
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

      <Modal visible={referenceOpen} transparent animationType="fade">
        <Pressable
          style={styles.referenceOverlay}
          onPress={() => setReferenceOpen(false)}
        >
          <Image
            source={{ uri: sourceImage }}
            style={styles.referenceImage}
            resizeMode="contain"
          />
          <Text style={styles.referenceText}>Kapatmak için dokun</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 42,
    backgroundColor: '#1a1a2e',
  },

  header: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexWrap: 'wrap',
  },

  headerBtn: {
    backgroundColor: '#0f3460',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9456050',
  },

  headerBtnText: {
    color: '#e0e0e0',
    fontWeight: '700',
    fontSize: 12,
  },

  disabledBtn: {
    opacity: 0.45,
  },

  board: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#0f3460',
    overflow: 'hidden',
  },

  frameArea: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#87b6ff55',
    backgroundColor: '#ffffff06',
    borderRadius: 6,
  },

  boardReferenceImage: {
    position: 'absolute',
    opacity: 0.11,
    borderRadius: 8,
  },

  boardLabel: {
    color: '#e0e0e0',
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

  lockedBadge: {
    position: 'absolute',
    right: 2,
    top: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#7CFF8A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  lockedBadgeText: {
    color: '#102010',
    fontSize: 11,
    fontWeight: '900',
  },

  progressBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#00000066',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    zIndex: 999,
  },

  progressText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  floatingCleanBtn: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: '#e94560',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    zIndex: 999,
  },

  floatingCleanText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },

  sheetBg: {
    backgroundColor: '#0f3460',
    overflow: 'visible',
  },

  sheetLayer: {
  zIndex: 5,
  elevation: 5,
  overflow: 'visible',
},

  indicator: {
    backgroundColor: '#e94560',
    width: 40,
  },

  trayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  trayTitle: {
  color: '#e0e0e0',
  fontWeight: '800',
  fontSize: 15,
  userSelect: 'none',
},

  trayModeText: {
  color: '#ffffff88',
  fontSize: 11,
  marginTop: 2,
  fontWeight: '600',
  userSelect: 'none',
},

  sendBtn: {
    backgroundColor: '#e94560',
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
  zIndex: 99999,
  elevation: 99999,
  overflow: 'visible',
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

  edgeBadge: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ffd166',
    alignItems: 'center',
    justifyContent: 'center',
  },

  edgeBadgeText: {
    color: '#111',
    fontSize: 10,
    fontWeight: '900',
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
  overflow: 'visible',
  zIndex: 999999,
  elevation: 999999,
},

  dragHintBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffffdd',
    alignItems: 'center',
    justifyContent: 'center',
  },

  trayPieceDragging: {
  opacity: 0.12,
},

dragPreviewLayer: {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  zIndex: 999999,
  elevation: 999999,
  pointerEvents: 'none',
},

dragPreviewPiece: {
  position: 'absolute',
  overflow: 'visible',
  zIndex: 999999,
  elevation: 999999,
},

  dragHintText: {
    color: '#0f3460',
    fontSize: 13,
    fontWeight: '900',
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
    backgroundColor: '#000000aa',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalBox: {
    width: width * 0.9,
    backgroundColor: '#0f3460',
    borderRadius: 16,
    padding: 18,
  },

  modalTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
    marginBottom: 14,
    textAlign: 'center',
  },

  gallerySelectBtn: {
    backgroundColor: '#e94560',
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
    color: '#e0e0e0',
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
    backgroundColor: '#e94560',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },

  indicatorDisabled: {
  opacity: 0.2,
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