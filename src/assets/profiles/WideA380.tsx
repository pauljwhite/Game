interface Props { color?: string; className?: string }

export function WideA380({ color = 'currentColor', className }: Props) {
  return (
    <svg viewBox="0 0 200 80" className={className} style={{ color }}>
      {/* Double-deck: very tall, fat fuselage */}
      <ellipse cx="100" cy="40" rx="86" ry="17" fill={color} />
      {/* Upper deck windows (whole upper half) */}
      {[130,142,154,166,178].map(x => (
        <rect key={x} x={x} y="28" width="6" height="6" fill="white" opacity="0.4" />
      ))}
      {/* Lower deck windows */}
      {[130,142,154,166,178].map(x => (
        <rect key={x} x={x} y="45" width="6" height="6" fill="white" opacity="0.4" />
      ))}
      <ellipse cx="184" cy="40" rx="8" ry="11" fill={color} />
      <polygon points="14,40 28,26 28,54" fill={color} />
      {/* Tall vertical tail */}
      <polygon points="18,40 18,8 46,28" fill={color} />
      {/* Horizontal stabilizer */}
      <polygon points="16,36 16,44 50,22 50,58" fill={color} />
      {/* Enormous wings, no winglets (A380 has curved raked tips) */}
      <polygon points="120,40 116,48 52,68 44,62 114,38" fill={color} />
      <polygon points="120,40 116,32 52,12 44,18 114,42" fill={color} />
      {/* 4 large engines */}
      <ellipse cx="92" cy="70" rx="17" ry="6" fill={color} opacity="0.85" />
      <ellipse cx="72" cy="76" rx="14" ry="5" fill={color} opacity="0.85" />
      <ellipse cx="92" cy="10" rx="17" ry="6" fill={color} opacity="0.85" />
      <ellipse cx="72" cy="4" rx="14" ry="5" fill={color} opacity="0.85" />
    </svg>
  );
}
