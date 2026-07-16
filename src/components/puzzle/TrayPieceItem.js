import React, { useMemo, useState } from 'react';
import { PanResponder, Text, TouchableOpacity, View } from 'react-native';
import PieceImage from './PieceImage';
import { THEME } from '../../constants/theme';
import styles from '../../screens/PuzzleScreen.styles';

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

export default TrayPieceItem;
