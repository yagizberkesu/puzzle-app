import React, { useRef, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Dimensions, Image, ScrollView, Modal, Pressable } from 'react-native';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');
const SNAP_POINTS = ['12%', '40%', '75%'];

// Alt tepside parçaların kaç sütun halinde görüneceği
const TRAY_COLS = 4; 

const PRESETS = [
  { id: 'p1', label: 'Sarı Çiçekler', uri: 'https://images.unsplash.com/photo-1490750967868-88df5691cc8a?w=800' },
  { id: 'p2', label: 'Kiraz',         uri: 'https://images.unsplash.com/photo-1528821128474-27f963b062bf?w=800' },
  { id: 'p3', label: 'Nar',           uri: 'https://images.unsplash.com/photo-1541344999736-83eca272f6fc?w=800' },
];

function sliceImage(uri, rows, cols) {
  return Array.from({ length: rows * cols }, (_, i) => ({
    id: i,
    uri,
    row: Math.floor(i / cols),
    col: i % cols,
    rows,
    cols,
  }));
}

export default function PuzzleScreen() {
  const sheetRef = useRef(null);
  const [sourceImage, setSourceImage] = React.useState(null);
  const [pieces, setPieces]           = React.useState([]);
  const [imgSize, setImgSize]         = React.useState({ w: 1, h: 1 });
  
  // Modallar için State'ler
  const [presetOpen, setPresetOpen]         = React.useState(false);
  const [difficultyOpen, setDifficultyOpen] = React.useState(false);
  const [pendingUri, setPendingUri]         = React.useState(null);

  // Resim seçildiğinde hemen kesme, zorluk sor
  const applyImage = (uri) => {
    setPendingUri(uri);
    setDifficultyOpen(true);
  };

  // Zorluk seçildiğinde resmi seçilen parça sayısına göre kes
  const onDifficultySelect = (totalPieces) => {
    setDifficultyOpen(false);
    Image.getSize(pendingUri, (w, h) => {
      setImgSize({ w, h });
      setSourceImage(pendingUri);
      
      // Şimdilik kedi kafası algoritması yok, seçilen sayıya en yakın kare ızgarayı oluşturuyoruz (örn: 400 parça = 20x20)
      const gridDimension = Math.round(Math.sqrt(totalPieces));
      setPieces(sliceImage(pendingUri, gridDimension, gridDimension)); 
    });
  };

  const pickFromGallery = async () => {
    setPresetOpen(false); // Modal'ı kapatıp galeriyi açıyoruz
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!result.canceled) applyImage(result.assets[0].uri);
  };

  const renderPiece = useCallback(({ item }) => {
    const tileW = (width - 48) / TRAY_COLS;
    const tileH = tileW * (imgSize.h / imgSize.w);
    return (
      <View style={[styles.piece, { width: tileW, height: tileH, overflow: 'hidden' }]}>
        <Image
          source={{ uri: item.uri }}
          style={{
            width:  tileW * item.cols,
            height: tileH * item.rows,
            transform: [
              { translateX: -item.col * tileW },
              { translateY: -item.row * tileH },
            ],
          }}
        />
      </View>
    );
  }, [imgSize, pieces.length]);

  return (
    <View style={styles.container}>
      
      {/* Sol Üst Galeri İkonu */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.galleryIconBtn} onPress={() => setPresetOpen(true)}>
          <Text style={styles.galleryIconText}>🖼️ Galeri</Text>
        </TouchableOpacity>
      </View>

      {/* Board */}
      <View style={styles.board}>
        {sourceImage
          ? <Image source={{ uri: sourceImage }} style={styles.boardImage} resizeMode="contain" />
          : <Text style={styles.boardLabel}>Başlamak için resim seçin</Text>}
      </View>

      {/* Preset Modal (Hem Galeri Hem Temalar) */}
      <Modal visible={presetOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setPresetOpen(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Resim Seç</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              
              {/* + Galeriden Ekle Seçeneği */}
              <TouchableOpacity style={styles.presetCard} onPress={pickFromGallery}>
                <View style={styles.addFromGalleryBox}>
                  <Text style={styles.addIcon}>+</Text>
                </View>
                <Text style={styles.presetLabel}>Galeriden Seç</Text>
              </TouchableOpacity>

              {/* Hazır Temalar */}
              {PRESETS.map(p => (
                <TouchableOpacity key={p.id} style={styles.presetCard} onPress={() => { applyImage(p.uri); setPresetOpen(false); }}>
                  <Image source={{ uri: p.uri }} style={styles.presetThumb} />
                  <Text style={styles.presetLabel}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Zorluk Seçim Modalı */}
      <Modal visible={difficultyOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setDifficultyOpen(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Kaç Parça Olsun?</Text>
            <View style={styles.difficultyRow}>
              {[400, 600, 1000, 2000].map(num => (
                <TouchableOpacity key={num} style={styles.diffBtn} onPress={() => onDifficultySelect(num)}>
                  <Text style={styles.diffBtnText}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Tray */}
      <BottomSheet ref={sheetRef} index={0} snapPoints={SNAP_POINTS} backgroundStyle={styles.sheetBg} handleIndicatorStyle={styles.indicator}>
        <View style={styles.trayHeader}>
          <Text style={styles.trayTitle}>Parçalar ({pieces.length})</Text>
          <TouchableOpacity style={styles.sendBtn}>
            <Text style={styles.sendBtnText}>Tahtaya 20 Parça Gönder</Text>
          </TouchableOpacity>
        </View>
        <BottomSheetFlatList
          data={pieces}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPiece}
          numColumns={TRAY_COLS}
          contentContainerStyle={styles.pieceGrid}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#1a1a2e', paddingTop: 40 },
  header:            { paddingHorizontal: 16, paddingBottom: 10, alignItems: 'flex-start' },
  galleryIconBtn:    { backgroundColor: '#0f3460', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e9456050' },
  galleryIconText:   { color: '#e0e0e0', fontWeight: '600', fontSize: 14 },
  board:             { flex: 1, marginHorizontal: 12, marginBottom: 12, borderRadius: 12, backgroundColor: '#16213e', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#0f3460' },
  boardLabel:        { color: '#e0e0e0', fontSize: 16, opacity: 0.4 },
  boardImage:        { width: '100%', height: '100%', borderRadius: 12 },
  sheetBg:           { backgroundColor: '#0f3460' },
  indicator:         { backgroundColor: '#e94560', width: 40 },
  trayHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  trayTitle:         { color: '#e0e0e0', fontWeight: '700', fontSize: 15 },
  sendBtn:           { backgroundColor: '#e94560', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  sendBtnText:       { color: '#fff', fontSize: 12, fontWeight: '600' },
  pieceGrid:         { paddingHorizontal: 8, paddingBottom: 40 },
  piece:             { width: (width - 48) / TRAY_COLS, aspectRatio: 1, margin: 4, backgroundColor: '#16213e', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e9456030' },
  
  /* Modallar İçin Stiller */
  modalOverlay:      { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center' },
  modalBox:          { backgroundColor: '#0f3460', borderRadius: 16, padding: 20, width: width * 0.9 },
  modalTitle:        { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 14, textAlign: 'center' },
  scrollContent:     { alignItems: 'center' },
  presetCard:        { marginRight: 12, alignItems: 'center' },
  presetThumb:       { width: 110, height: 110, borderRadius: 10, marginBottom: 6 },
  addFromGalleryBox: { width: 110, height: 110, borderRadius: 10, marginBottom: 6, backgroundColor: '#16213e', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#e94560', borderStyle: 'dashed' },
  addIcon:           { color: '#e94560', fontSize: 40, fontWeight: '200' },
  presetLabel:       { color: '#e0e0e0', fontSize: 12, fontWeight: '500' },
  
  /* Zorluk Seçimi Stilleri */
  difficultyRow:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  diffBtn:           { backgroundColor: '#e94560', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, width: '45%', alignItems: 'center' },
  diffBtnText:       { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});