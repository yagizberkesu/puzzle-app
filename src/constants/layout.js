import { Dimensions } from 'react-native';

export const { width, height } = Dimensions.get('window');
export const TRAY_COLS = width > 900 ? 6 : 4;
