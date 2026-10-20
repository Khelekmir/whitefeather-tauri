import {
  MAGIC_DIR_DEGREES,
  type MagicQteDirection,
} from '../utils/combat/magicDirectionalQte';

/**
 * Unit arrowhead pointing up: tip at top; indented base also points toward tip.
 * ViewBox coords −1..1; rotate for other directions.
 */
export const UP_ARROW_POINTS = '0,-1 0.78,0.62 0,0.18 -0.78,0.62';

export const DIR_ROTATION = MAGIC_DIR_DEGREES;

export const DIR_LABEL: Record<MagicQteDirection, string> = {
  up: '↑ / W',
  down: '↓ / S',
  left: '← / A',
  right: '→ / D',
};

export function MagicQteArrowHead({
  direction,
  fill,
  stroke,
  strokeWidth = 0.06,
  opacity = 1,
}: {
  direction: MagicQteDirection;
  fill: string;
  stroke: string;
  strokeWidth?: number;
  opacity?: number;
}) {
  return (
    <g transform={`rotate(${DIR_ROTATION[direction]})`} opacity={opacity}>
      <polygon
        points={UP_ARROW_POINTS}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </g>
  );
}
