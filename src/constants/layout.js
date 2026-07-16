import { Dimensions } from 'react-native';

export const { width, height } = Dimensions.get('window');

// Genişlik eşikleri: tablet/geniş ekran ve dar/kompakt telefon ekranı ayrımı.
export const BREAKPOINT_TABLET = 900;
export const BREAKPOINT_COMPACT = 700;
