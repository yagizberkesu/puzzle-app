import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { THEME } from '../../constants/theme';

function TopBarIcon({ type, active = false, disabled = false }) {
  const stroke = disabled ? '#b8b8b8' : active ? THEME.purple : THEME.black;

  if (type === 'back') {
    return (
      <Svg width={30} height={30} viewBox="0 0 30 30">
        <Line
          x1="19"
          y1="6"
          x2="9"
          y2="15"
          stroke={stroke}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <Line
          x1="9"
          y1="15"
          x2="19"
          y2="24"
          stroke={stroke}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <Line
          x1="10"
          y1="15"
          x2="27"
          y2="15"
          stroke={stroke}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (type === 'broom') {
    return (
      <Svg width={30} height={30} viewBox="0 0 30 30">
        <Line
          x1="18"
          y1="4"
          x2="14"
          y2="13"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Path
          d="M10 13 H23 L21 24 H7 Z"
          stroke={stroke}
          strokeWidth={2}
          fill="none"
          strokeLinejoin="round"
        />
        <Line
          x1="10"
          y1="17"
          x2="21"
          y2="17"
          stroke={stroke}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <Line
          x1="10"
          y1="21"
          x2="20"
          y2="21"
          stroke={stroke}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (type === 'edge') {
    return (
      <Svg width={30} height={30} viewBox="0 0 30 30">
        <Line
          x1="8"
          y1="23"
          x2="23"
          y2="8"
          stroke={stroke}
          strokeWidth={2.1}
          strokeLinecap="round"
        />
        <Line
          x1="14"
          y1="24"
          x2="24"
          y2="14"
          stroke={stroke}
          strokeWidth={2.1}
          strokeLinecap="round"
        />
        <Line
          x1="6"
          y1="16"
          x2="16"
          y2="6"
          stroke={stroke}
          strokeWidth={2.1}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (type === 'hint') {
    return (
      <Svg width={32} height={32} viewBox="0 0 32 32">
        <Path
          d="M10 14.5 C10 10.5 12.7 8 16 8 C19.3 8 22 10.5 22 14.5 C22 17.2 20.5 18.9 18.7 20.3 C18.1 20.8 17.8 21.3 17.8 22 H14.2 C14.2 20.6 14.8 19.5 15.9 18.6 C17.4 17.4 18.2 16.4 18.2 14.7 C18.2 12.9 17.3 11.8 16 11.8 C14.7 11.8 13.8 12.9 13.8 14.5"
          stroke={stroke}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Line
          x1="14"
          y1="25"
          x2="18"
          y2="25"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (type === 'reference') {
    return (
      <Svg width={32} height={32} viewBox="0 0 32 32">
        <Rect
          x="8"
          y="8"
          width="16"
          height="16"
          stroke={stroke}
          strokeWidth={1.8}
          fill="none"
          strokeDasharray="4 3"
        />
        <Path
          d="M13 19 L17 19 L17 15 L21 15 L21 21 L13 21 Z"
          stroke={stroke}
          strokeWidth={1.8}
          fill="none"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (type === 'eye') {
    return (
      <Svg width={34} height={34} viewBox="0 0 34 34">
        <Path
          d="M4 17 C7.8 10.8 12.3 8 17 8 C21.7 8 26.2 10.8 30 17 C26.2 23.2 21.7 26 17 26 C12.3 26 7.8 23.2 4 17 Z"
          stroke={stroke}
          strokeWidth={2}
          fill="none"
          strokeLinejoin="round"
        />
        <Circle cx="17" cy="17" r="4.2" stroke={stroke} strokeWidth={2} fill="none" />
      </Svg>
    );
  }

  return null;
}

export default TopBarIcon;
