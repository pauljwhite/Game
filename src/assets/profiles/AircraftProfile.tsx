import type { AircraftType } from '@/types/aircraft';
import type { ReactElement } from 'react';

interface AircraftProfileProps {
  type: AircraftType;
  color?: string;
  className?: string;
}

type EngineLayout =
  | 'underwing-two'
  | 'underwing-four'
  | 'rear-two'
  | 'rear-three'
  | 'rear-four'
  | 'turboprop-two'
  | 'supersonic';

interface ProfileSpec {
  length: number;
  height: number;
  wing: 'low' | 'high' | 'delta';
  tail: 'standard' | 't-tail' | 'swept' | 'supersonic';
  engines: EngineLayout;
  nose: 'round' | 'pointed' | 'needle';
  deck?: 'hump' | 'double';
  stretch?: number;
}

const FAMILY_SPECS: Record<string, Partial<ProfileSpec>> = {
  '707': { engines: 'underwing-four', tail: 'swept', nose: 'pointed', wing: 'low', height: 17 },
  'DC-8': { engines: 'underwing-four', tail: 'swept', nose: 'pointed', wing: 'low', height: 17 },
  'Il-14': { engines: 'turboprop-two', tail: 'standard', nose: 'round', wing: 'low', height: 17 },
  'Il-18': { engines: 'turboprop-two', tail: 'standard', nose: 'round', wing: 'low', height: 18 },
  'An-24': { engines: 'turboprop-two', tail: 'standard', nose: 'round', wing: 'high', height: 16 },
  'Caravelle': { engines: 'rear-two', tail: 'standard', nose: 'pointed', wing: 'low', height: 16 },
  'Tu-104': { engines: 'rear-two', tail: 'standard', nose: 'pointed', wing: 'low', height: 17 },
  'Tu-124': { engines: 'rear-two', tail: 'standard', nose: 'pointed', wing: 'low', height: 15 },
  'Yak-40': { engines: 'rear-three', tail: 't-tail', nose: 'round', wing: 'low', height: 15 },
  '727': { engines: 'rear-three', tail: 't-tail', nose: 'pointed', wing: 'low', height: 17 },
  'DC-9': { engines: 'rear-two', tail: 't-tail', nose: 'pointed', wing: 'low', height: 16 },
  'Il-62': { engines: 'rear-four', tail: 't-tail', nose: 'pointed', wing: 'low', height: 18 },
  '737': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 17 },
  '747': { engines: 'underwing-four', tail: 'swept', nose: 'round', wing: 'low', height: 22, deck: 'hump' },
  'DC-10': { engines: 'rear-three', tail: 'standard', nose: 'round', wing: 'low', height: 21 },
  'L-1011': { engines: 'rear-three', tail: 'standard', nose: 'round', wing: 'low', height: 21 },
  'A300': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 20 },
  'A310': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 19 },
  'MD-80': { engines: 'rear-two', tail: 't-tail', nose: 'pointed', wing: 'low', height: 17 },
  'MD-11': { engines: 'rear-three', tail: 'standard', nose: 'round', wing: 'low', height: 21 },
  'A220': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 17 },
  'A320': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 17 },
  'A320neo': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 17 },
  'A330': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 21 },
  'A330neo': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 21 },
  'A340': { engines: 'underwing-four', tail: 'swept', nose: 'round', wing: 'low', height: 21 },
  'A350': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 21 },
  'A380': { engines: 'underwing-four', tail: 'swept', nose: 'round', wing: 'low', height: 25, deck: 'double' },
  '717': { engines: 'rear-two', tail: 't-tail', nose: 'pointed', wing: 'low', height: 16 },
  '737 MAX': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 17 },
  '757': { engines: 'underwing-two', tail: 'swept', nose: 'pointed', wing: 'low', height: 18 },
  '767': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 20 },
  '777': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 22 },
  '777X': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 22 },
  '787': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 21 },
  'Tu-134': { engines: 'rear-two', tail: 't-tail', nose: 'pointed', wing: 'low', height: 16 },
  Concorde: { engines: 'supersonic', tail: 'supersonic', nose: 'needle', wing: 'delta', height: 13 },
  'Tu-144': { engines: 'supersonic', tail: 'supersonic', nose: 'needle', wing: 'delta', height: 14 },
  'Tu-154': { engines: 'rear-three', tail: 't-tail', nose: 'pointed', wing: 'low', height: 18 },
  'Tu-204': { engines: 'underwing-two', tail: 'swept', nose: 'pointed', wing: 'low', height: 18 },
  'Il-86': { engines: 'underwing-four', tail: 'swept', nose: 'round', wing: 'low', height: 22 },
  'Il-96': { engines: 'underwing-four', tail: 'swept', nose: 'round', wing: 'low', height: 21 },
  'Yak-42': { engines: 'rear-three', tail: 't-tail', nose: 'pointed', wing: 'low', height: 17 },
  'MC-21': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 18 },
  CRJ: { engines: 'rear-two', tail: 't-tail', nose: 'pointed', wing: 'low', height: 15 },
  'Q Series': { engines: 'turboprop-two', tail: 'standard', nose: 'round', wing: 'high', height: 17 },
  'Dash 8': { engines: 'turboprop-two', tail: 'standard', nose: 'round', wing: 'high', height: 17 },
};

const MODEL_TWEAKS: Record<string, Partial<ProfileSpec>> = {
  'b707-120': { length: 135 },
  'b707-320': { length: 148 },
  'dc8-50': { length: 150 },
  il14: { length: 82 },
  il18: { length: 116 },
  caravelle: { length: 108 },
  tu104a: { length: 116 },
  an24: { length: 92 },
  tu124: { length: 88 },
  yak40: { length: 77 },
  'b727-100': { length: 119 },
  'b727-200': { length: 138 },
  'dc9-10': { length: 97 },
  'dc9-30': { length: 112 },
  il62: { length: 155 },
  'il-62m': { length: 157 },
  'b737-100': { length: 101 },
  'b737-200': { length: 114 },
  'b747-100': { length: 164 },
  'b747-200': { length: 168 },
  'b747-300': { length: 170 },
  'b747-400': { length: 171 },
  'b747-8i': { length: 184 },
  'dc10-10': { length: 150 },
  'dc10-30': { length: 156 },
  'dc10-40': { length: 156 },
  'l1011-1': { length: 152 },
  'l1011-100': { length: 152 },
  'l1011-200': { length: 154 },
  'l1011-500': { length: 142 },
  'a300-600': { length: 149 },
  'a310-300': { length: 132 },
  md80: { length: 133 },
  md11: { length: 160 },
  'a220-100': { length: 104 },
  'a220-300': { length: 118 },
  a318: { length: 100 },
  a319: { length: 111 },
  a319neo: { length: 111 },
  a320: { length: 119 },
  a320neo: { length: 119 },
  a321: { length: 134 },
  a321neo: { length: 134 },
  a321xlr: { length: 137 },
  'a330-200': { length: 157 },
  'a330-300': { length: 171 },
  'a330-800neo': { length: 158 },
  'a330-900neo': { length: 172 },
  'a340-300': { length: 171 },
  'a340-600': { length: 184 },
  'a350-900': { length: 172 },
  'a350-1000': { length: 184 },
  'a380-800': { length: 184 },
  'b717-200': { length: 108 },
  'b737-600': { length: 101 },
  'b737-700': { length: 112 },
  'b737-800': { length: 127 },
  'b737-900er': { length: 136 },
  b737max7: { length: 112 },
  b737max8: { length: 127 },
  b737max9: { length: 136 },
  b737max10: { length: 141 },
  'b757-200': { length: 148 },
  'b757-300': { length: 164 },
  'b767-200er': { length: 151 },
  'b767-300er': { length: 166 },
  'b767-400er': { length: 176 },
  'b777-200': { length: 174 },
  'b777-200er': { length: 174 },
  'b777-200lr': { length: 174 },
  'b777-300er': { length: 186 },
  'b777-9': { length: 190 },
  'b787-8': { length: 155 },
  'b787-9': { length: 169 },
  'b787-10': { length: 184 },
  'tu-134a': { length: 103 },
  concorde: { length: 176 },
  'tu-144': { length: 180 },
  'tu-154b': { length: 144 },
  'tu-154m': { length: 148 },
  'tu-204-100': { length: 143 },
  'tu-204-300': { length: 126 },
  'tu-214': { length: 147 },
  'il-86': { length: 163 },
  'il-96-300': { length: 156 },
  'il-96-400': { length: 176 },
  'yak-42d': { length: 116 },
  'mc-21-300': { length: 132 },
  'mc-21-310': { length: 132 },
  crj200: { length: 88 },
  crj700: { length: 105 },
  crj900: { length: 119 },
  crj1000: { length: 131 },
  q400: { length: 122 },
  'dhc8-100': { length: 82 },
  'dhc8-200': { length: 86 },
  'dhc8-300': { length: 99 },
  'dhc8-400': { length: 122 },
};

function getSpec(type: AircraftType): ProfileSpec {
  const family = FAMILY_SPECS[type.familyName] ?? {};
  const baseLength = type.category === 'widebody'
    ? 142 + Math.min(42, type.seatsEconomy * 0.09)
    : type.category === 'regional'
      ? 74 + Math.min(48, type.seatsEconomy * 0.38)
      : 96 + Math.min(48, type.seatsEconomy * 0.22);

  return {
    length: baseLength,
    height: type.category === 'widebody' ? 21 : type.category === 'regional' ? 16 : 17,
    wing: 'low',
    tail: 'swept',
    engines: type.profileId === 'regional-turboprop' ? 'turboprop-two' : 'underwing-two',
    nose: 'round',
    ...family,
    ...MODEL_TWEAKS[type.id],
  };
}

function fuselagePath(x: number, y: number, length: number, height: number, nose: ProfileSpec['nose']) {
  const r = height / 2;
  if (nose === 'needle') {
    return `M ${x + 5} ${y + r - 4} C ${x + 15} ${y + 2}, ${x + length - 35} ${y}, ${x + length - 6} ${y + r - 1} L ${x + length + 12} ${y + r} L ${x + length - 6} ${y + r + 1} C ${x + length - 35} ${y + height}, ${x + 15} ${y + height - 2}, ${x + 5} ${y + r + 4} Z`;
  }
  const noseBulge = nose === 'pointed' ? 8 : 0;
  return `M ${x + 7} ${y + r - 6} C ${x + 15} ${y + 1}, ${x + length - 20} ${y}, ${x + length - 6} ${y + r - 3 - noseBulge / 3} C ${x + length + 6} ${y + r}, ${x + length - 6} ${y + r + 3 + noseBulge / 3}, ${x + length - 20} ${y + height} C ${x + 42} ${y + height + 2}, ${x + 11} ${y + height - 1}, ${x + 7} ${y + r + 6} C ${x - 1} ${y + r + 3}, ${x - 1} ${y + r - 3}, ${x + 7} ${y + r - 6} Z`;
}

function windowPositions(x: number, y: number, length: number, rows: 1 | 2, count: number) {
  const start = x + Math.max(28, length * 0.18);
  const end = x + length - Math.max(20, length * 0.16);
  const step = (end - start) / Math.max(1, count - 1);
  const positions: Array<{ x: number; y: number }> = [];
  for (let row = 0; row < rows; row += 1) {
    for (let i = 0; i < count; i += 1) {
      positions.push({ x: start + i * step, y: y + 8 + row * 7 });
    }
  }
  return positions;
}

function enginePods(layout: EngineLayout, x: number, y: number, length: number, height: number) {
  const pods: ReactElement[] = [];
  const pod = (key: string, cx: number, cy: number, w: number, h: number) => (
    <g key={key}>
      <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} fill="currentColor" opacity="0.68" />
      <ellipse cx={cx + w * 0.18} cy={cy} rx={w / 5} ry={h / 3.1} fill="#0f172a" opacity="0.55" />
    </g>
  );

  if (layout === 'underwing-two') {
    pods.push(pod('l', x + length * 0.48, y + height + 10, 15, 11));
    pods.push(pod('r', x + length * 0.65, y + height + 10, 15, 11));
  }
  if (layout === 'underwing-four') {
    [0.38, 0.48, 0.63, 0.73].forEach((p, i) => pods.push(pod(`q${i}`, x + length * p, y + height + 10, 11, 9)));
  }
  if (layout === 'rear-two' || layout === 'rear-three') {
    pods.push(pod('rear-a', x + length * 0.13, y + height * 0.45, 18, 10));
    pods.push(pod('rear-b', x + length * 0.2, y + height * 0.45, 18, 10));
  }
  if (layout === 'rear-three') {
    pods.push(pod('sduct', x + length * 0.16, y - 1, 15, 9));
  }
  if (layout === 'rear-four') {
    [0.09, 0.15, 0.21, 0.27].forEach((p, i) => pods.push(pod(`rq${i}`, x + length * p, y + height * 0.48, 13, 8)));
  }
  if (layout === 'supersonic') {
    pods.push(<rect key="ss-a" x={x + length * 0.36} y={y + height + 4} width={length * 0.16} height={8} rx={2} fill="currentColor" opacity="0.72" />);
    pods.push(<rect key="ss-b" x={x + length * 0.56} y={y + height + 4} width={length * 0.16} height={8} rx={2} fill="currentColor" opacity="0.72" />);
  }
  return pods;
}

function propellers(x: number, y: number, length: number, height: number) {
  const points = [x + length * 0.36, x + length * 0.64];
  return points.map((cx, i) => (
    <g key={i} opacity="0.9">
      <circle cx={cx} cy={y + height * 0.42} r={9} fill="none" stroke="currentColor" strokeWidth={1.3} opacity="0.45" />
      <path d={`M ${cx} ${y + height * 0.42 - 9} L ${cx} ${y + height * 0.42 + 9} M ${cx - 8} ${y + height * 0.42} L ${cx + 8} ${y + height * 0.42}`} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" opacity="0.7" />
    </g>
  ));
}

export function AircraftProfile({ type, color = '#60a5fa', className }: AircraftProfileProps) {
  const spec = getSpec(type);
  const x = (220 - spec.length) / 2;
  const y = spec.deck === 'double' ? 31 : spec.height > 21 ? 33 : 37;
  const height = spec.height;
  const wingY = spec.wing === 'high' ? y + 3 : y + height - 2;
  const windowCount = Math.max(5, Math.min(24, Math.round(spec.length / 8)));
  const windowRows = spec.deck === 'double' ? 2 : 1;

  const lowWing = `M ${x + spec.length * 0.4} ${wingY} L ${x + spec.length * 0.66} ${wingY + 4} L ${x + spec.length * 0.83} ${wingY + 22} L ${x + spec.length * 0.5} ${wingY + 11} L ${x + spec.length * 0.25} ${wingY + 26} L ${x + spec.length * 0.33} ${wingY + 4} Z`;
  const highWing = `M ${x + spec.length * 0.28} ${wingY} L ${x + spec.length * 0.71} ${wingY} L ${x + spec.length * 0.86} ${wingY - 9} L ${x + spec.length * 0.54} ${wingY - 4} L ${x + spec.length * 0.24} ${wingY + 9} Z`;
  const deltaWing = `M ${x + spec.length * 0.28} ${y + height - 1} L ${x + spec.length * 0.82} ${y + height + 13} L ${x + spec.length * 0.42} ${y + height + 26} Z`;

  return (
    <svg viewBox="0 0 220 90" className={className} style={{ color }} role="img" aria-label={`${type.manufacturer} ${type.model} side profile`}>
      <g fill="none" stroke="none">
        <path d={spec.wing === 'delta' ? deltaWing : spec.wing === 'high' ? highWing : lowWing} fill="currentColor" opacity="0.24" />
        {spec.engines === 'turboprop-two' && propellers(x, y, spec.length, height)}
        <path d={fuselagePath(x, y, spec.length, height, spec.nose)} fill="currentColor" opacity="0.9" />

        {spec.deck === 'hump' && (
          <path d={`M ${x + 16} ${y + 1} C ${x + 38} ${y - 13}, ${x + 72} ${y - 8}, ${x + 88} ${y + 4} L ${x + 88} ${y + 13} C ${x + 58} ${y + 9}, ${x + 34} ${y + 8}, ${x + 14} ${y + 13} Z`} fill="currentColor" opacity="0.9" />
        )}

        {spec.tail === 't-tail' ? (
          <>
            <path d={`M ${x + 12} ${y + 5} L ${x + 32} ${y - 23} L ${x + 39} ${y + 6} Z`} fill="currentColor" opacity="0.86" />
            <path d={`M ${x + 20} ${y - 19} L ${x + 53} ${y - 22} L ${x + 43} ${y - 14} L ${x + 17} ${y - 14} Z`} fill="currentColor" opacity="0.68" />
          </>
        ) : spec.tail === 'supersonic' ? (
          <path d={`M ${x + 10} ${y + 4} L ${x + 38} ${y - 13} L ${x + 32} ${y + height - 1} Z`} fill="currentColor" opacity="0.86" />
        ) : (
          <path d={`M ${x + 11} ${y + 5} L ${x + 36} ${y - 19} L ${x + 39} ${y + height + 2} L ${x + 19} ${y + height - 1} Z`} fill="currentColor" opacity="0.86" />
        )}

        {enginePods(spec.engines, x, y, spec.length, height)}

        {windowPositions(x, y, spec.length, windowRows, windowCount).map((pt, i) => (
          <rect key={i} x={pt.x - 1.1} y={pt.y - 1.1} width={2.2} height={2.2} rx={0.8} fill="#e0f2fe" opacity="0.88" />
        ))}

        <path d={`M ${x + spec.length - 17} ${y + 5} C ${x + spec.length - 10} ${y + 6}, ${x + spec.length - 6} ${y + 8}, ${x + spec.length - 3} ${y + 11}`} stroke="#e0f2fe" strokeWidth={1.3} strokeLinecap="round" opacity="0.95" />

        {type.familyName === '777X' && (
          <path d={`M ${x + spec.length * 0.84} ${wingY + 19} L ${x + spec.length * 0.9} ${wingY + 10}`} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" opacity="0.65" />
        )}

        {(type.familyName === 'Concorde' || type.familyName === 'Tu-144') && (
          <path d={`M ${x + spec.length * 0.18} ${y + height + 3} L ${x + spec.length * 0.29} ${y + height + 8} L ${x + spec.length * 0.19} ${y + height + 11} Z`} fill="currentColor" opacity="0.5" />
        )}
      </g>
    </svg>
  );
}
