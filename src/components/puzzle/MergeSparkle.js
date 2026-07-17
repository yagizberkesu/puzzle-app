import React, { useEffect, useRef } from 'react';
import { Animated, Text } from 'react-native';

const EMOJIS = ['✨', '💫', '⭐'];

// Parça birleşince board üzerinde kısa süreliğine beliren, yukarı kayarak
// solan bir pırıltı. Ömrü tamamen kendi animasyonuyla belirleniyor —
// PuzzleScreen bu süre sonunda state'ten kaldırıyor (bkz. triggerPieceMergeFeedback).
const MergeSparkle = React.memo(function MergeSparkle({ x, y, emojiIndex = 0 }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 0.7, 1],
    outputRange: [0, 1, 1, 0],
  });

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -34],
  });

  const scale = progress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0.4, 1.15, 0.9],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 14,
        top: y - 14,
        opacity,
        transform: [{ translateY }, { scale }],
      }}
    >
      <Text style={{ fontSize: 26 }}>{EMOJIS[emojiIndex % EMOJIS.length]}</Text>
    </Animated.View>
  );
});

export default MergeSparkle;
