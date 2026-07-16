import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, View } from 'react-native';
import { groupBounds } from '../../utils/puzzleGroups';
import { pieceSize, visualSize } from '../../utils/puzzleGeometry';
import PieceImage from './PieceImage';
import styles from '../../screens/PuzzleScreen.styles';

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

export default DraggableGroup;
