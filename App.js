import * as ImagePicker from 'expo-image-picker';
import { Image, ScrollView, Modal, Pressable } from 'react-native';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import PuzzleScreen from './src/screens/PuzzleScreen';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <PuzzleScreen />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });