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
  signature?:
    | '707'
    | '727'
    | '737-classic'
    | '737-ng'
    | '737-max'
    | '747-classic'
    | '747-8'
    | '757'
    | '767'
    | '777'
    | '777x'
    | '787'
    | 'a300'
    | 'a320'
    | 'a330'
    | 'a340'
    | 'a350'
    | 'a380'
    | 'caravelle'
    | 'concorde'
    | 'tu144'
    | 'dc8'
    | 'dc9'
    | 'dc10'
    | 'l1011'
    | 'md11'
    | 'il62'
    | 'il86'
    | 'il96'
    | 'tu104'
    | 'tu154'
    | 'tu204'
    | 'yak40'
    | 'yak42'
    | 'crj'
    | 'dash8'
    | 'an24'
    | 'il18'
    | 'il14'
    | 'a220'
    | 'mc21';
}

const FAMILY_SPECS: Record<string, Partial<ProfileSpec>> = {
  '707': { engines: 'underwing-four', tail: 'swept', nose: 'pointed', wing: 'low', height: 17, signature: '707' },
  'DC-8': { engines: 'underwing-four', tail: 'swept', nose: 'pointed', wing: 'low', height: 17, signature: 'dc8' },
  'Il-14': { engines: 'turboprop-two', tail: 'standard', nose: 'round', wing: 'low', height: 17, signature: 'il14' },
  'Il-18': { engines: 'turboprop-two', tail: 'standard', nose: 'round', wing: 'low', height: 18, signature: 'il18' },
  'An-24': { engines: 'turboprop-two', tail: 'standard', nose: 'round', wing: 'high', height: 16, signature: 'an24' },
  'Caravelle': { engines: 'rear-two', tail: 'standard', nose: 'pointed', wing: 'low', height: 16, signature: 'caravelle' },
  'Tu-104': { engines: 'rear-two', tail: 'standard', nose: 'pointed', wing: 'low', height: 17, signature: 'tu104' },
  'Tu-124': { engines: 'rear-two', tail: 'standard', nose: 'pointed', wing: 'low', height: 15 },
  'Yak-40': { engines: 'rear-three', tail: 't-tail', nose: 'round', wing: 'low', height: 15, signature: 'yak40' },
  '727': { engines: 'rear-three', tail: 't-tail', nose: 'pointed', wing: 'low', height: 17, signature: '727' },
  'DC-9': { engines: 'rear-two', tail: 't-tail', nose: 'pointed', wing: 'low', height: 16, signature: 'dc9' },
  'Il-62': { engines: 'rear-four', tail: 't-tail', nose: 'pointed', wing: 'low', height: 18, signature: 'il62' },
  '737': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 17, signature: '737-classic' },
  '747': { engines: 'underwing-four', tail: 'swept', nose: 'round', wing: 'low', height: 22, deck: 'hump', signature: '747-classic' },
  'DC-10': { engines: 'rear-three', tail: 'standard', nose: 'round', wing: 'low', height: 21, signature: 'dc10' },
  'L-1011': { engines: 'rear-three', tail: 'standard', nose: 'round', wing: 'low', height: 21, signature: 'l1011' },
  'A300': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 20, signature: 'a300' },
  'A310': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 19, signature: 'a300' },
  'MD-80': { engines: 'rear-two', tail: 't-tail', nose: 'pointed', wing: 'low', height: 17, signature: 'dc9' },
  'MD-11': { engines: 'rear-three', tail: 'standard', nose: 'round', wing: 'low', height: 21, signature: 'md11' },
  'A220': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 17, signature: 'a220' },
  'A320': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 17, signature: 'a320' },
  'A320neo': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 17, signature: 'a320' },
  'A330': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 21, signature: 'a330' },
  'A330neo': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 21, signature: 'a330' },
  'A340': { engines: 'underwing-four', tail: 'swept', nose: 'round', wing: 'low', height: 21, signature: 'a340' },
  'A350': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 21, signature: 'a350' },
  'A380': { engines: 'underwing-four', tail: 'swept', nose: 'round', wing: 'low', height: 25, deck: 'double', signature: 'a380' },
  '717': { engines: 'rear-two', tail: 't-tail', nose: 'pointed', wing: 'low', height: 16 },
  '737 MAX': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 17, signature: '737-max' },
  '757': { engines: 'underwing-two', tail: 'swept', nose: 'pointed', wing: 'low', height: 18, signature: '757' },
  '767': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 20, signature: '767' },
  '777': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 22, signature: '777' },
  '777X': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 22, signature: '777x' },
  '787': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 21, signature: '787' },
  'Tu-134': { engines: 'rear-two', tail: 't-tail', nose: 'pointed', wing: 'low', height: 16 },
  Concorde: { engines: 'supersonic', tail: 'supersonic', nose: 'needle', wing: 'delta', height: 13, signature: 'concorde' },
  'Tu-144': { engines: 'supersonic', tail: 'supersonic', nose: 'needle', wing: 'delta', height: 14, signature: 'tu144' },
  'Tu-154': { engines: 'rear-three', tail: 't-tail', nose: 'pointed', wing: 'low', height: 18, signature: 'tu154' },
  'Tu-204': { engines: 'underwing-two', tail: 'swept', nose: 'pointed', wing: 'low', height: 18, signature: 'tu204' },
  'Il-86': { engines: 'underwing-four', tail: 'swept', nose: 'round', wing: 'low', height: 22, signature: 'il86' },
  'Il-96': { engines: 'underwing-four', tail: 'swept', nose: 'round', wing: 'low', height: 21, signature: 'il96' },
  'Yak-42': { engines: 'rear-three', tail: 't-tail', nose: 'pointed', wing: 'low', height: 17, signature: 'yak42' },
  'MC-21': { engines: 'underwing-two', tail: 'swept', nose: 'round', wing: 'low', height: 18, signature: 'mc21' },
  CRJ: { engines: 'rear-two', tail: 't-tail', nose: 'pointed', wing: 'low', height: 15, signature: 'crj' },
  'Q Series': { engines: 'turboprop-two', tail: 'standard', nose: 'round', wing: 'high', height: 17, signature: 'dash8' },
  'Dash 8': { engines: 'turboprop-two', tail: 'standard', nose: 'round', wing: 'high', height: 17, signature: 'dash8' },
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
  'b737-600': { length: 101, signature: '737-ng' },
  'b737-700': { length: 112, signature: '737-ng' },
  'b737-800': { length: 127, signature: '737-ng' },
  'b737-900er': { length: 136, signature: '737-ng' },
  'b747-100': { length: 164 },
  'b747-200': { length: 168 },
  'b747-300': { length: 170 },
  'b747-400': { length: 171 },
  'b747-8i': { length: 184, signature: '747-8' },
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
  'a380-800': { length: 184, signature: 'a380' },
  'b717-200': { length: 108, signature: 'dc9' },
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

function fuselagePath(x: number, y: number, length: number, height: number, nose: ProfileSpec['nose'], signature?: ProfileSpec['signature']) {
  const r = height / 2;
  if (nose === 'needle') {
    const droop = signature === 'concorde' ? 4 : 1;
    return `M ${x + 6} ${y + r - 4} C ${x + 25} ${y + 2}, ${x + length - 42} ${y + 1}, ${x + length - 11} ${y + r - 2} L ${x + length + 15} ${y + r + droop} L ${x + length - 9} ${y + r + 3} C ${x + length - 42} ${y + height - 1}, ${x + 24} ${y + height - 2}, ${x + 6} ${y + r + 4} Z`;
  }
  if (signature === '787' || signature === 'a350') {
    return `M ${x + 8} ${y + r - 6} C ${x + 29} ${y}, ${x + length - 34} ${y - 1}, ${x + length - 8} ${y + r - 2} C ${x + length + 7} ${y + r + 1}, ${x + length - 7} ${y + r + 6}, ${x + length - 28} ${y + height} C ${x + 50} ${y + height + 2}, ${x + 14} ${y + height - 1}, ${x + 8} ${y + r + 6} C ${x - 2} ${y + r + 3}, ${x - 2} ${y + r - 3}, ${x + 8} ${y + r - 6} Z`;
  }
  if (signature === 'a380') {
    return `M ${x + 10} ${y + r - 9} C ${x + 35} ${y - 3}, ${x + length - 34} ${y - 4}, ${x + length - 7} ${y + r - 4} C ${x + length + 8} ${y + r + 1}, ${x + length - 7} ${y + r + 8}, ${x + length - 36} ${y + height + 1} C ${x + 52} ${y + height + 3}, ${x + 16} ${y + height}, ${x + 8} ${y + r + 8} C ${x - 4} ${y + r + 4}, ${x - 3} ${y + r - 5}, ${x + 10} ${y + r - 9} Z`;
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

function enginePods(layout: EngineLayout, x: number, y: number, length: number, height: number, signature?: ProfileSpec['signature']) {
  const pods: ReactElement[] = [];
  const pod = (key: string, cx: number, cy: number, w: number, h: number) => (
    <g key={key}>
      <ellipse cx={cx + 1.2} cy={cy + 1.5} rx={w / 2} ry={h / 2} fill="#94a3b8" opacity="0.25" />
      <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} fill="#f8fafc" stroke="#94a3b8" strokeWidth={0.9} />
      <ellipse cx={cx + w * 0.22} cy={cy} rx={w / 5.4} ry={h / 3.5} fill="#334155" opacity="0.42" />
      <path d={`M ${cx - w * 0.38} ${cy + h * 0.2} C ${cx - w * 0.18} ${cy + h * 0.35}, ${cx + w * 0.22} ${cy + h * 0.35}, ${cx + w * 0.4} ${cy + h * 0.1}`} stroke="#cbd5e1" strokeWidth={0.7} strokeLinecap="round" />
    </g>
  );

  if (layout === 'underwing-two') {
    const wide = signature === '777' || signature === '777x' ? 22 : signature === '787' || signature === 'a350' ? 20 : signature === '737-max' ? 17 : 15;
    pods.push(pod('l', x + length * 0.47, y + height + 10, wide, wide * 0.72));
    pods.push(pod('r', x + length * 0.66, y + height + 10, wide, wide * 0.72));
  }
  if (layout === 'underwing-four') {
    const big = signature === 'a380' || signature === '747-8' ? 13 : 11;
    [0.36, 0.47, 0.62, 0.73].forEach((p, i) => pods.push(pod(`q${i}`, x + length * p, y + height + 10, big, big * 0.8)));
  }
  if (layout === 'rear-two' || layout === 'rear-three') {
    const slim = signature === 'crj' || signature === 'dc9' ? 16 : 18;
    pods.push(pod('rear-a', x + length * 0.13, y + height * 0.45, slim, 10));
    pods.push(pod('rear-b', x + length * 0.2, y + height * 0.45, slim, 10));
  }
  if (layout === 'rear-three') {
    const yOffset = signature === 'dc10' || signature === 'l1011' || signature === 'md11' ? -3 : -1;
    pods.push(pod('sduct', x + length * 0.16, y + yOffset, 15, 9));
  }
  if (layout === 'rear-four') {
    [0.09, 0.15, 0.21, 0.27].forEach((p, i) => pods.push(pod(`rq${i}`, x + length * p, y + height * 0.48, 13, 8)));
  }
  if (layout === 'supersonic') {
    pods.push(<rect key="ss-a" x={x + length * 0.36} y={y + height + 4} width={length * 0.16} height={8} rx={2} fill="#f8fafc" stroke="#94a3b8" strokeWidth={0.9} />);
    pods.push(<rect key="ss-b" x={x + length * 0.56} y={y + height + 4} width={length * 0.16} height={8} rx={2} fill="#f8fafc" stroke="#94a3b8" strokeWidth={0.9} />);
  }
  return pods;
}

function tailPaths(spec: ProfileSpec, x: number, y: number, height: number, accent: string) {
  const tallT = spec.signature === '727' || spec.signature === 'tu154' || spec.signature === 'il62' || spec.signature === 'crj';
  if (spec.tail === 't-tail') {
    const tailTop = y - (tallT ? 28 : 23);
    const finBack = spec.signature === 'il62' ? 44 : 38;
    return (
      <>
        <path d={`M ${x + 12} ${y + 6} L ${x + finBack} ${tailTop} L ${x + 42} ${y + 7} Z`} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1} />
        <path d={`M ${x + 18} ${tailTop + 2} L ${x + 58} ${tailTop - 1} L ${x + 46} ${tailTop + 8} L ${x + 17} ${tailTop + 8} Z`} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={0.8} />
        <path d={`M ${x + 18} ${y + 2} L ${x + 34} ${tailTop + 7} L ${x + 38} ${y + 5} Z`} fill={accent} opacity="0.28" />
      </>
    );
  }
  if (spec.tail === 'supersonic') {
    return <path d={`M ${x + 10} ${y + 4} L ${x + 40} ${y - 13} L ${x + 31} ${y + height} Z`} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1} />;
  }
  const sweptTop = spec.signature === '747-classic' || spec.signature === '747-8' || spec.signature === 'a380' ? y - 28 : y - 20;
  return (
    <>
      <path d={`M ${x + 11} ${y + 6} L ${x + 40} ${sweptTop} L ${x + 42} ${y + height + 2} L ${x + 20} ${y + height} Z`} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1} />
      <path d={`M ${x + 18} ${y + 3} L ${x + 34} ${sweptTop + 8} L ${x + 38} ${y + 8} Z`} fill={accent} opacity="0.26" />
    </>
  );
}

function propellers(x: number, y: number, length: number, height: number) {
  const points = [x + length * 0.36, x + length * 0.64];
  return points.map((cx, i) => (
    <g key={i} opacity="0.9">
      <circle cx={cx} cy={y + height * 0.42} r={9} fill="none" stroke="#64748b" strokeWidth={1.2} opacity="0.48" />
      <path d={`M ${cx} ${y + height * 0.42 - 9} L ${cx} ${y + height * 0.42 + 9} M ${cx - 8} ${y + height * 0.42} L ${cx + 8} ${y + height * 0.42}`} stroke="#475569" strokeWidth={1.4} strokeLinecap="round" opacity="0.7" />
    </g>
  ));
}

function landingGear(x: number, y: number, length: number, height: number, signature?: ProfileSpec['signature']) {
  const mainX = signature === 'tu154' || signature === '727' || signature === 'dc9' ? x + length * 0.36 : x + length * 0.48;
  const noseX = x + length * 0.86;
  const gearY = y + height + 14;
  const wheel = (key: string, cx: number, cy: number, r = 2.8) => (
    <circle key={key} cx={cx} cy={cy} r={r} fill="#1f2937" stroke="#e5e7eb" strokeWidth={0.8} />
  );

  return (
    <g opacity="0.86">
      <path d={`M ${mainX - 2} ${y + height - 1} L ${mainX - 5} ${gearY - 3} M ${mainX + 5} ${y + height - 1} L ${mainX + 3} ${gearY - 3} M ${noseX} ${y + height - 1} L ${noseX} ${gearY - 3}`} stroke="#64748b" strokeWidth={1.1} strokeLinecap="round" />
      {wheel('m1', mainX - 7, gearY)}
      {wheel('m2', mainX, gearY)}
      {wheel('m3', mainX + 7, gearY)}
      {wheel('n1', noseX, gearY, 2.4)}
    </g>
  );
}

export function AircraftProfile({ type, color = '#60a5fa', className }: AircraftProfileProps) {
  const spec = getSpec(type);
  const x = (220 - spec.length) / 2;
  const y = spec.deck === 'double' ? 31 : spec.height > 21 ? 33 : 37;
  const height = spec.height;
  const wingY = spec.wing === 'high' ? y + 3 : y + height - 2;
  const windowCount = Math.max(5, Math.min(24, Math.round(spec.length / 8)));
  const windowRows = spec.deck === 'double' ? 2 : 1;

  const wingSweep = spec.signature === 'a350' || spec.signature === '787' || spec.signature === '777x' ? 0.9 : 1;
  const lowWing = `M ${x + spec.length * 0.36} ${wingY} L ${x + spec.length * 0.66} ${wingY + 4} L ${x + spec.length * 0.86} ${wingY + 22 * wingSweep} L ${x + spec.length * 0.5} ${wingY + 11} L ${x + spec.length * 0.23} ${wingY + 27 * wingSweep} L ${x + spec.length * 0.31} ${wingY + 4} Z`;
  const highWing = `M ${x + spec.length * 0.28} ${wingY} L ${x + spec.length * 0.71} ${wingY} L ${x + spec.length * 0.86} ${wingY - 9} L ${x + spec.length * 0.54} ${wingY - 4} L ${x + spec.length * 0.24} ${wingY + 9} Z`;
  const deltaWing = `M ${x + spec.length * 0.28} ${y + height - 1} L ${x + spec.length * 0.88} ${y + height + 13} L ${x + spec.length * 0.43} ${y + height + 27} Z`;

  return (
    <svg viewBox="0 0 220 90" className={className} style={{ color }} role="img" aria-label={`${type.manufacturer} ${type.model} side profile`}>
      <defs>
        <linearGradient id={`body-${type.id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.56" stopColor="#f8fafc" />
          <stop offset="1" stopColor="#cbd5e1" />
        </linearGradient>
        <linearGradient id={`metal-${type.id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f8fafc" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="none">
        <path d={spec.wing === 'delta' ? deltaWing : spec.wing === 'high' ? highWing : lowWing} fill={`url(#metal-${type.id})`} stroke="#94a3b8" strokeWidth={0.8} opacity="0.74" />
        {spec.engines === 'turboprop-two' && propellers(x, y, spec.length, height)}
        <path d={fuselagePath(x, y, spec.length, height, spec.nose, spec.signature)} fill={`url(#body-${type.id})`} stroke="#94a3b8" strokeWidth={1.1} />

        <path d={`M ${x + 18} ${y + height - 4} C ${x + 56} ${y + height - 1}, ${x + spec.length - 42} ${y + height - 2}, ${x + spec.length - 10} ${y + height - 6}`} stroke="#94a3b8" strokeWidth={0.65} strokeLinecap="round" opacity="0.42" />
        <path d={`M ${x + 36} ${y + height * 0.58} C ${x + 74} ${y + height * 0.5}, ${x + spec.length - 42} ${y + height * 0.48}, ${x + spec.length - 18} ${y + height * 0.52}`} stroke={color} strokeWidth={1.2} strokeLinecap="round" opacity="0.3" />

        {spec.deck === 'hump' && (
          <path d={`M ${x + spec.length - 96} ${y + 5} C ${x + spec.length - 80} ${y - 11}, ${x + spec.length - 38} ${y - 12}, ${x + spec.length - 10} ${y + 3} L ${x + spec.length - 9} ${y + 14} C ${x + spec.length - 42} ${y + 9}, ${x + spec.length - 72} ${y + 9}, ${x + spec.length - 100} ${y + 14} Z`} fill={`url(#body-${type.id})`} stroke="#94a3b8" strokeWidth={1} />
        )}

        {tailPaths(spec, x, y, height, color)}

        {enginePods(spec.engines, x, y, spec.length, height, spec.signature)}

        {windowPositions(x, y, spec.length, windowRows, windowCount).map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r={1.15} fill="#64748b" opacity="0.88" />
        ))}

        {spec.deck === 'hump' && windowPositions(x + spec.length - 104, y - 1, 76, 1, 9).map((pt, i) => (
          <circle key={`hump-${i}`} cx={pt.x} cy={pt.y} r={1.08} fill="#64748b" opacity="0.88" />
        ))}

        {spec.signature === 'a380' && (
          <path d={`M ${x + 28} ${y + 10} C ${x + 70} ${y + 7}, ${x + spec.length - 28} ${y + 7}, ${x + spec.length - 8} ${y + 12}`} stroke="#64748b" strokeWidth={1.1} strokeLinecap="round" opacity="0.42" />
        )}

        <path d={`M ${x + spec.length - 17} ${y + 5} C ${x + spec.length - 10} ${y + 6}, ${x + spec.length - 6} ${y + 8}, ${x + spec.length - 3} ${y + 11}`} stroke="#334155" strokeWidth={1.1} strokeLinecap="round" opacity="0.82" />

        {Array.from({ length: Math.max(4, Math.min(11, Math.round(spec.length / 16))) }).map((_, i) => {
          const px = x + 26 + i * ((spec.length - 56) / Math.max(1, Math.min(10, Math.round(spec.length / 16)) - 1));
          return <path key={`panel-${i}`} d={`M ${px} ${y + 5} L ${px + 1} ${y + height - 4}`} stroke="#94a3b8" strokeWidth={0.45} opacity="0.22" />;
        })}

        {(spec.signature === '787' || spec.signature === 'a350') && (
          <path d={`M ${x + spec.length * 0.48} ${wingY + 10} C ${x + spec.length * 0.7} ${wingY + 18}, ${x + spec.length * 0.82} ${wingY + 19}, ${x + spec.length * 0.9} ${wingY + 13}`} stroke="#64748b" strokeWidth={1.6} strokeLinecap="round" opacity="0.42" />
        )}

        {spec.signature === '777x' && (
          <path d={`M ${x + spec.length * 0.84} ${wingY + 19} L ${x + spec.length * 0.9} ${wingY + 10}`} stroke="#64748b" strokeWidth={2.2} strokeLinecap="round" opacity="0.72" />
        )}

        {(spec.signature === 'concorde' || spec.signature === 'tu144') && (
          <path d={`M ${x + spec.length * 0.18} ${y + height + 3} L ${x + spec.length * 0.29} ${y + height + 8} L ${x + spec.length * 0.19} ${y + height + 11} Z`} fill="#cbd5e1" stroke="#94a3b8" strokeWidth={0.7} />
        )}

        {spec.signature === 'tu144' && (
          <path d={`M ${x + spec.length * 0.73} ${y + height - 1} L ${x + spec.length * 0.83} ${y + height + 6} L ${x + spec.length * 0.75} ${y + height + 4} Z`} fill="#cbd5e1" stroke="#94a3b8" strokeWidth={0.7} />
        )}

        {(spec.signature === 'dc10' || spec.signature === 'md11') && (
          <path d={`M ${x + 20} ${y - 2} C ${x + 31} ${y - 10}, ${x + 43} ${y - 7}, ${x + 48} ${y + 1}`} stroke="#94a3b8" strokeWidth={1.6} strokeLinecap="round" opacity="0.64" />
        )}

        {spec.signature === 'l1011' && (
          <path d={`M ${x + 17} ${y - 1} C ${x + 34} ${y - 16}, ${x + 46} ${y - 9}, ${x + 50} ${y + 2}`} stroke="#94a3b8" strokeWidth={1.6} strokeLinecap="round" opacity="0.64" />
        )}

        {landingGear(x, y, spec.length, height, spec.signature)}
      </g>
    </svg>
  );
}
