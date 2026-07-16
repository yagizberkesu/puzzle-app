import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, Image as SvgImage, Path } from 'react-native-svg';
import { jigsawPath, overhang, visualSize } from '../../utils/puzzleGeometry';
import styles from '../../screens/PuzzleScreen.styles';

const PieceImage = React.memo(function PieceImage({
  piece,
  size,
  highlightColor,
}) {
  const oh = overhang(size);
  const vs = visualSize(size);

  const path = useMemo(
    () => jigsawPath(piece, size),
    [piece.id, piece.row, piece.col, piece.rows, piece.cols, size]
  );

  const clipId = useMemo(
    () =>
      `clip_${String(piece.id).replace(/[^a-zA-Z0-9_]/g, '_')}_${Math.round(
        size * 1000
      )}`,
    [piece.id, size]
  );

  return (
    <View style={[styles.pieceImageBox, { width: vs, height: vs }]}>
      <Svg width={vs} height={vs} viewBox={`0 0 ${vs} ${vs}`}>
        <Defs>
          <ClipPath id={clipId}>
            <Path d={path} />
          </ClipPath>
        </Defs>

        <SvgImage
          href={{ uri: piece.uri }}
          x={oh - piece.col * size}
          y={oh - piece.row * size}
          width={size * piece.cols}
          height={size * piece.rows}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />

        {highlightColor ? (
          <Path d={path} fill="none" stroke={highlightColor} strokeWidth={1.15} />
        ) : (
          <>
            <Path d={path} fill="none" stroke="#00000035" strokeWidth={1.05} />
            <Path d={path} fill="none" stroke="#ffffff22" strokeWidth={0.35} />
          </>
        )}
      </Svg>
    </View>
  );
});

export default PieceImage;
