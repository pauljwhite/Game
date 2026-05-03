interface Props { color?: string; className?: string }

export function NarrowClassic({ color = 'currentColor', className }: Props) {
  return (
    <svg viewBox="0 0 200 80" className={className} style={{ color }}>
      {/* Fuselage */}
      <ellipse cx="100" cy="38" rx="88" ry="10" fill={color} />
      {/* Nose */}
      <ellipse cx="186" cy="38" rx="6" ry="7" fill={color} />
      {/* Tail */}
      <polygon points="12,38 26,30 26,46" fill={color} />
      {/* Vertical tail */}
      <polygon points="20,38 20,18 38,30" fill={color} />
      {/* Horizontal stabilizer */}
      <polygon points="20,36 20,40 42,32 42,44" fill={color} />
      {/* Main wings - straight, slightly swept */}
      <polygon points="110,38 108,42 60,56 55,52 105,36" fill={color} />
      <polygon points="110,38 108,34 60,20 55,24 105,40" fill={color} />
      {/* 2 underwing pod engines (round) */}
      <ellipse cx="80" cy="58" rx="12" ry="4" fill={color} opacity="0.85" />
      <ellipse cx="80" cy="20" rx="12" ry="4" fill={color} opacity="0.85" />
      {/* Windows row */}
      {[145,155,165,175].map(x => (
        <rect key={x} x={x} y="35" width="5" height="5" fill="white" opacity="0.4" />
      ))}
    </svg>
  );
}
