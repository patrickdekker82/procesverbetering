import type { ShapeKind } from '../../core/diagram';
import type { ValueClass } from '../../core/model';

const FILL: Record<ValueClass | 'UNSET', string> = {
  CUSTOMER: '#f0fdf4',
  BUSINESS: '#f0f9ff',
  NONE: '#fef2f2',
  UNSET: '#ffffff',
};
const STROKE: Record<ValueClass | 'UNSET', string> = {
  CUSTOMER: '#16a34a',
  BUSINESS: '#0284c7',
  NONE: '#dc2626',
  UNSET: '#475569',
};

/** SVG outline of a palette shape, drawn in the shape's own pixel size. */
export function ShapeOutline({
  kind,
  width: w,
  height: h,
  valueClass,
  selected,
}: {
  kind: ShapeKind;
  width: number;
  height: number;
  valueClass?: ValueClass;
  selected?: boolean;
}) {
  const key = valueClass ?? 'UNSET';
  let fill = FILL[key];
  let stroke = STROKE[key];
  if (kind === 'start') [fill, stroke] = ['#dcfce7', '#15803d'];
  if (kind === 'end') [fill, stroke] = ['#e2e8f0', '#0f172a'];
  if (kind === 'decision') [fill, stroke] = ['#fffbeb', '#d97706'];
  if (kind === 'wait') [fill, stroke] = ['#fff7ed', '#ea580c'];
  if (kind === 'data') [fill, stroke] = ['#f8fafc', '#64748b'];
  if (kind === 'note') [fill, stroke] = ['#fefce8', '#a16207'];
  const sw = selected ? 2.5 : kind === 'end' ? 2.5 : 1.5;
  const i = sw; // inset so the stroke is not clipped
  const W = w - i;
  const H = h - i;
  let shape;
  switch (kind) {
    case 'start':
    case 'end':
      shape = <rect x={i} y={i} width={W - i} height={H - i} rx={(H - i) / 2} />;
      break;
    case 'decision':
      shape = <polygon points={`${w / 2},${i} ${W},${h / 2} ${w / 2},${H} ${i},${h / 2}`} />;
      break;
    case 'subprocess':
      shape = (
        <>
          <rect x={i} y={i} width={W - i} height={H - i} rx={3} />
          <line x1={i + 8} y1={i} x2={i + 8} y2={H} />
          <line x1={W - 8} y1={i} x2={W - 8} y2={H} />
        </>
      );
      break;
    case 'document':
      shape = (
        <path
          d={`M${i},${i} H${W} V${h * 0.82} C${w * 0.72},${h * 0.66} ${w * 0.3},${h * 1.02} ${i},${h * 0.84} Z`}
        />
      );
      break;
    case 'manual':
      shape = <polygon points={`${i},${h * 0.22} ${W},${i} ${W},${H} ${i},${H}`} />;
      break;
    case 'wait':
      shape = (
        <path
          d={`M${i},${i} H${W - (H - i) / 2} A${(H - i) / 2},${(H - i) / 2} 0 0 1 ${W - (H - i) / 2},${H} H${i} Z`}
        />
      );
      break;
    case 'data': {
      const ry = Math.min(12, h * 0.15);
      shape = (
        <>
          <path d={`M${i},${ry + i} V${H - ry} A${(W - i) / 2},${ry} 0 0 0 ${W},${H - ry} V${ry + i}`} />
          <ellipse cx={w / 2} cy={ry + i} rx={(W - i) / 2} ry={ry} />
        </>
      );
      break;
    }
    case 'note':
      shape = (
        <>
          <rect x={0} y={0} width={w} height={h} stroke="none" />
          <path d={`M14,${i} H${i} V${H} H14`} fill="none" />
        </>
      );
      break;
    default:
      shape = <rect x={i} y={i} width={W - i} height={H - i} rx={6} />;
  }
  return (
    <svg width={w} height={h} className="absolute inset-0 overflow-visible" aria-hidden="true">
      <g fill={fill} stroke={stroke} strokeWidth={sw}>
        {shape}
      </g>
    </svg>
  );
}
