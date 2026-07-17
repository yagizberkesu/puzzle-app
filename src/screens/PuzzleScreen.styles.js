import { Platform, StyleSheet } from 'react-native';
import { THEME } from '../constants/theme';
import { BREAKPOINT_COMPACT, width } from '../constants/layout';
import { TOP_BAR_HEIGHT, TRAY_GRID_H_PADDING, TRAY_ITEM_GAP } from '../constants/puzzle';

const styles = StyleSheet.create({

  safeRoot: {
  flex: 1,
  backgroundColor: THEME.top,
},

  container: {
  flex: 1,
  backgroundColor: THEME.bg,
  userSelect: 'none',
},

  homeScroll: {
    flex: 1,
    backgroundColor: THEME.bg,
  },

  homeContent: {
  paddingHorizontal: 18,
  paddingTop: 14,
  paddingBottom: 36,
},

  homeHero: {
  backgroundColor: THEME.white,
  borderRadius: 22,
  padding: 20,
  marginTop: 0,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 3,
  },

  homeEyebrow: {
    color: THEME.purple,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 8,
  },

  homeTitle: {
    color: THEME.text,
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 8,
  },

  homeSubtitle: {
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },

  homePrimaryButton: {
    backgroundColor: THEME.purple,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },

  homePrimaryButtonText: {
    color: THEME.white,
    fontSize: 15,
    fontWeight: '900',
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
  },

  sectionTitle: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },

  sectionCount: {
    color: THEME.purple,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 12,
  },

  homePresetRow: {
    flexDirection: 'row',
    gap: 10,
  },

  homePresetCard: {
    flex: 1,
    backgroundColor: THEME.white,
    borderRadius: 18,
    padding: 8,
    borderWidth: 1,
    borderColor: '#ececec',
  },

  homePresetImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    marginBottom: 8,
  },

  homePresetLabel: {
    color: '#333',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },

  emptyBox: {
    backgroundColor: THEME.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#ececec',
  },

  emptyTitle: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },

  emptyText: {
    color: THEME.muted,
    fontSize: 13,
    lineHeight: 18,
  },

  puzzleCardGrid: {
    gap: 14,
  },

  puzzleCard: {
    backgroundColor: THEME.white,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e9e9e9',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 2,
  },

  puzzleCardImage: {
    width: '100%',
    height: Math.min(220, width * 0.52),
    backgroundColor: '#ddd',
  },

  progressBubble: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: THEME.purple,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: THEME.white,
  },

  progressBubbleText: {
    color: THEME.white,
    fontSize: 14,
    fontWeight: '900',
  },

  puzzleCardBody: {
    padding: 14,
  },

  puzzleCardTitle: {
    color: THEME.text,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4,
  },

  puzzleCardMeta: {
    color: THEME.muted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
  },

  cardProgressTrack: {
    height: 7,
    backgroundColor: '#ece8f7',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 12,
  },

  cardProgressFill: {
    height: '100%',
    backgroundColor: THEME.purple,
    borderRadius: 999,
  },

  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardActionText: {
    color: THEME.purple,
    fontSize: 13,
    fontWeight: '900',
  },

  cardDeleteText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '800',
  },

  gameTopBar: {
  height: TOP_BAR_HEIGHT,
  paddingHorizontal: 14,
  backgroundColor: THEME.top,
  borderBottomWidth: 1,
  borderBottomColor: THEME.topLine,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 6,
  elevation: 4,
  zIndex: 50,
},

topBarSideLeft: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: width > BREAKPOINT_COMPACT ? 120 : 18,
},

topBarSideRight: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: width > BREAKPOINT_COMPACT ? 120 : 18,
},

topScoreAbsolute: {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  alignItems: 'center',
  justifyContent: 'center',
},

  topIconButton: {
  width: 38,
  height: 38,
  borderRadius: 19,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'transparent',
},

  topIconButtonActive: {
    backgroundColor: '#f0e9ff',
  },

  topIconButtonActiveSoft: {
    backgroundColor: '#ececec',
  },

  topIconButtonDisabled: {
    opacity: 0.42,
  },


  topScoreText: {
    color: THEME.orange,
    fontSize: 20,
    fontWeight: '900',
    textShadowColor: '#00000020',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  topOrangeBadge: {
    position: 'absolute',
    right: 0,
    top: 1,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: THEME.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },

  topOrangeBadgeText: {
    color: THEME.white,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
  },

  board: {
  flex: 1,
  marginHorizontal: 10,
  marginTop: 10,
  marginBottom: 6,
  borderRadius: 0,
  backgroundColor: THEME.board,
  borderWidth: 1,
  borderColor: THEME.boardLine,
  overflow: 'hidden',
},

  boardCanvas: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'visible',
  },

  frameArea: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#d2d2d2',
    backgroundColor: '#e9e9e9',
    borderRadius: 0,
  },

  boardReferenceImage: {
    position: 'absolute',
    opacity: 0.38,
    borderRadius: 0,
  },

  boardLabel: {
    color: THEME.text,
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

  boardToolLayer: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 10,
    zIndex: 1000,
    elevation: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  boardMiniButton: {
    backgroundColor: '#ffffffee',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },

  boardMiniButtonText: {
  color: '#333',
  fontSize: 10,
  fontWeight: '900',
},

  boardGestureHint: {
  color: '#555',
  fontSize: 10,
    fontWeight: '800',
    backgroundColor: '#ffffffcc',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },

  sheetLayer: {
    zIndex: 5,
    elevation: 5,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: -5 },
    shadowRadius: 14,
  },

  sheetBg: {
    backgroundColor: THEME.white,
    overflow: 'visible',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },

  indicator: {
    backgroundColor: '#cfcfcf',
    width: 42,
    height: 3,
  },

  indicatorDisabled: {
    opacity: 0.2,
  },

  trayHeader: {
    height: 64,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: THEME.white,
    userSelect: 'none',
  },

  trayTitle: {
    color: THEME.text,
    fontWeight: '900',
    fontSize: 15,
    userSelect: 'none',
  },

  trayModeText: {
    color: THEME.soft,
    fontSize: 11,
    marginTop: 2,
    fontWeight: '700',
    userSelect: 'none',
  },

  trayActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  modeBtn: {
    backgroundColor: '#f3f0fb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e3d9fb',
  },

  modeBtnText: {
    color: THEME.purple,
    fontSize: 12,
    fontWeight: '900',
  },

  sendBtn: {
    backgroundColor: THEME.purple,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },

  sendBtnText: {
    color: THEME.white,
    fontSize: 12,
    fontWeight: '900',
  },

  pieceGrid: {
  paddingHorizontal: TRAY_GRID_H_PADDING,
  paddingTop: 14,
  paddingBottom: Platform.OS === 'android' ? 150 : 118,
  overflow: 'visible',
  backgroundColor: THEME.white,
},

  trayPiece: {
    margin: TRAY_ITEM_GAP,
    overflow: 'visible',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },

  dragTrayPiece: {
    zIndex: 20,
    elevation: 20,
    overflow: 'visible',
  },

  trayPieceDragging: {
    opacity: 0.25,
  },

  selectedTrayPiece: {
    borderWidth: 2,
    borderColor: THEME.purple,
    borderRadius: 6,
    backgroundColor: THEME.white,
  },

  selectedBadge: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: THEME.purple2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedBadgeText: {
    color: THEME.white,
    fontSize: 14,
    fontWeight: '900',
  },

  trayFooter: {
    position: 'absolute',
    left: 34,
    right: 34,
    bottom: 28,
    zIndex: 100,
    elevation: 100,
  },

  traySendWide: {
    height: 66,
    borderRadius: 8,
    backgroundColor: THEME.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.purple,
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 5,
  },

  traySendWideText: {
    color: THEME.white,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  pieceImageBox: {
    overflow: 'visible',
    backgroundColor: 'transparent',
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
    left: 0,
    top: 0,
    overflow: 'visible',
    zIndex: 999999,
    elevation: 999999,
  },

  floatingReference: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: Math.min(width * 0.64, 330),
    aspectRatio: 1.18,
    backgroundColor: THEME.white,
    borderRadius: 8,
    padding: 6,
    zIndex: 9999,
    elevation: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
  },

  floatingReferenceImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#ddd',
  },

  floatingReferenceClose: {
    position: 'absolute',
    right: -8,
    top: -8,
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: THEME.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 4,
  },

  floatingReferenceCloseText: {
    color: THEME.black,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },

  disabledBtn: {
    opacity: 0.45,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000070',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalBox: {
    width: width * 0.9,
    backgroundColor: THEME.white,
    borderRadius: 16,
    padding: 18,
  },

  modalTitle: {
    color: THEME.text,
    fontWeight: '900',
    fontSize: 18,
    marginBottom: 14,
    textAlign: 'center',
  },

  modalSubtitle: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 14,
    fontWeight: '700',
  },

  difficultyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  diffCard: {
    width: '48%',
    backgroundColor: THEME.bg,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 10,
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 12,
    overflow: 'hidden',
  },

  diffCardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },

  diffCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },

  diffCardNumber: {
    color: THEME.text,
    fontWeight: '900',
    fontSize: 22,
  },

  diffCardGrid: {
    color: THEME.muted,
    fontSize: 12,
    marginTop: 2,
  },

  completionOverlay: {
    flex: 1,
    backgroundColor: '#00000088',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  confettiLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },

  confettiItem: {
    position: 'absolute',
    top: 0,
    fontWeight: '900',
  },

  completionCard: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: THEME.white,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee8ff',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 30,
    elevation: 10,
  },

  completionIconCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#f0e9ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  completionIcon: {
    fontSize: 38,
  },

  completionTitle: {
    color: THEME.text,
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 6,
  },

  completionSubtitle: {
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },

  completionStatsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 18,
  },

  completionStatBox: {
    flex: 1,
    backgroundColor: '#f7f4ff',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee8ff',
  },

  completionStatValue: {
    color: THEME.purple,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 2,
  },

  completionStatLabel: {
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '800',
  },

  completionPrimaryBtn: {
    width: '100%',
    backgroundColor: THEME.purple,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },

  completionPrimaryBtnText: {
    color: THEME.white,
    fontSize: 14,
    fontWeight: '900',
  },

  completionSecondaryBtn: {
    width: '100%',
    backgroundColor: '#f0e9ff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },

  completionSecondaryBtnText: {
    color: THEME.purple,
    fontSize: 14,
    fontWeight: '900',
  },

  completionGhostBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },

  completionGhostBtnText: {
    color: THEME.muted,
    fontSize: 13,
    fontWeight: '800',
  },
});
export default styles;
