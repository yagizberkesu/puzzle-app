import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';

const OPTIONS = [400, 600, 1000, 2000];

export default function DifficultyModal({ visible, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={s.overlay} onPress={onClose}>
        <View style={s.box}>
          <Text style={s.title}>Select Difficulty</Text>
          <Text style={s.sub}>Number of pieces</Text>
          <View style={s.grid}>
            {OPTIONS.map(n => (
              <TouchableOpacity key={n} style={s.option} onPress={() => onSelect(n)}>
                <Text style={s.optionNum}>{n}</Text>
                <Text style={s.optionLabel}>
                  {n <= 400 ? 'Easy' : n <= 600 ? 'Medium' : n <= 1000 ? 'Hard' : 'Expert'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: '#000000bb', justifyContent: 'center', alignItems: 'center' },
  box:        { backgroundColor: '#0f3460', borderRadius: 18, padding: 24, width: '80%' },
  title:      { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sub:        { color: '#e0e0e080', fontSize: 13, marginBottom: 20 },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  option:     { width: '46%', backgroundColor: '#16213e', borderRadius: 12, paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: '#e9456040' },
  optionNum:  { color: '#e94560', fontSize: 22, fontWeight: '800' },
  optionLabel:{ color: '#e0e0e0', fontSize: 12, marginTop: 4 },
});