import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Text, TouchableOpacity, View } from 'react-native';
import { CONFETTI } from '../../constants/puzzle';
import { height } from '../../constants/layout';
import styles from '../../screens/PuzzleScreen.styles';

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

export default CompletionModal;
