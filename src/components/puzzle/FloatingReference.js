import React, { useMemo, useRef } from 'react';
import { Animated, Image, PanResponder, Text, TouchableOpacity } from 'react-native';
import { clamp, distance } from '../../utils/puzzleGeometry';
import { width } from '../../constants/layout';
import styles from '../../screens/PuzzleScreen.styles';

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

export default FloatingReference;
