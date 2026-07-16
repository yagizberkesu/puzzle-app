import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useSharedValue } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  BOARD_PADDING,
  DIFFICULTIES,
  PRESETS,
  SELECT_MODE_INDEX,
  SEND_COUNT,
  STORAGE_KEY,
  TAB_RATIO,
} from '../constants/puzzle';
import { BREAKPOINT_COMPACT, TRAY_COLS, height, width } from '../constants/layout';
import {
  center,
  clamp,
  createPieces,
  distance,
  frameOrigin,
  pieceSize,
  visualSize,
} from '../utils/puzzleGeometry';
import {
  createGroup,
  frameSnapTarget,
  groupPieceCount,
  groupSnapTarget,
  mergeGroups,
  solvedPieceCount,
} from '../utils/puzzleGroups';
import { formatDate, progressOf } from '../utils/puzzleFormat';
import TopBarIcon from '../components/puzzle/TopBarIcon';
import PieceImage from '../components/puzzle/PieceImage';
import DraggableGroup from '../components/puzzle/DraggableGroup';
import TrayPieceItem from '../components/puzzle/TrayPieceItem';
import FloatingReference from '../components/puzzle/FloatingReference';
import CompletionModal from '../components/puzzle/CompletionModal';
import styles from './PuzzleScreen.styles';

export default function PuzzleScreen() {
  const sheetRef = useRef(null);
  const boardRef = useRef(null);
  const containerRef = useRef(null);

  // Sheet'in gerçek anlık ekran Y konumu (üst kenarı, tepeden piksel).
  // BottomSheet'e animatedPosition olarak veriliyor; sabit snapPoints
  // tahmini yerine parça bırakma bölgesini doğru hesaplamak için kullanılır.
  const sheetTopY = useSharedValue(height);

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
  const full = width < BREAKPOINT_COMPACT ? height * 0.54 : height * 0.72;

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
        if (__DEV__) console.log('Puzzle storage load error:', e);
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
      if (__DEV__) console.log('Puzzle storage save error:', e);
    });
  }, []);

  const updatePuzzleRecord = useCallback((id, updater) => {
    setSavedPuzzles((prev) => {
      const next = prev.map((r) => (r.id === id ? updater(r) : r));

      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((e) => {
        if (__DEV__) console.log('Puzzle storage save error:', e);
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

  // selectDifficulty ve openSavedPuzzle'ın ortak "puzzle ekranına gir + oyun
  // durumunu sıfırla" adımları. completionShownRef her girişte sıfırlanır ki
  // zaten tamamlanmış bir puzzle tekrar açıldığında tebrik modalı bir daha
  // gösterilebilsin.
  const enterPuzzleView = useCallback(() => {
    setSelectedPieceIds([]);
    setEdgeOnly(false);
    setHintOn(false);
    setSheetIndex(0);
    setDragPreview(null);
    setIsTrayPieceDragging(false);
    setCompletionOpen(false);

    completionShownRef.current = false;

    setScreenMode('puzzle');

    dragPreviewRef.current = null;
    dragPreviewPan.setValue({ x: 0, y: 0 });

    resetBoardCamera();

    requestAnimationFrame(() => {
      sheetRef.current?.snapToIndex(0);
    });
  }, [dragPreviewPan, resetBoardCamera]);

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
      if (__DEV__) console.log('Gallery pick error:', e);

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

      // Boş bir tepsi (record.pieces = []) geçerli bir durumdur: tüm parçalar
      // zaten board'a gönderilmiş demektir (tamamlanmış her puzzle'da böyle).
      // Bunu eksik veriyle karıştırıp yeni bir parça seti üretmek, toplam
      // parça sayısını ikiye katlayıp ilerlemeyi bozuyordu.
      setPieces(
        Array.isArray(record.pieces)
          ? record.pieces
          : createPieces(record.imageUri, record.totalPieces)
      );

      setBoardGroups(Array.isArray(record.boardGroups) ? record.boardGroups : []);

      enterPuzzleView();
    },
    [enterPuzzleView, queueDifficulty]
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
      setDifficultyOpen(false);
      setPendingUri(null);
      setPendingPuzzleId(null);

      enterPuzzleView();
    },
    [
      enterPuzzleView,
      pendingPuzzleId,
      pendingPuzzleTitle,
      pendingUri,
      persistPuzzles,
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

      if (final.y + final.visualSize / 2 >= sheetTopY.value) {
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
    [boardLayout, boardWindowLayout, origin, sheetTopY, snapToFrame]
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

  // "Aşağı" (tepsiyi küçült) ve "Sürükle" (seçim modundan çık) butonlarının
  // ikisi de aynı işlemi yapıyor: seçimi temizle, sheet'i en alta indir.
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

          {/* Sürükle modunda content panning kapalı: sheet'in native pan
              gesture'ı parça PanResponder'ını iptal ediyordu. Sadece seçim
              modunda (liste kaydırılırken) açık — bu native yarışı çözüyor. */}
          <BottomSheet
  ref={sheetRef}
  index={0}
  snapPoints={snapPoints}
  onChange={setSheetIndex}
  animatedPosition={sheetTopY}
  enableContentPanningGesture={isSelectionMode}
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
    <TouchableOpacity style={styles.modeBtn} onPress={collapseTray}>
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
                  <Text style={styles.traySendWideText}>Gönder ({selectedCount})</Text>
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
