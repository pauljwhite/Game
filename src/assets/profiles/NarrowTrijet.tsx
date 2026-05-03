interface Props { color?: string; className?: string }

export function NarrowTrijet({ color = 'currentColor', className }: Props) {
  return (
    <svg viewBox="0 0 200 80" className={className} style={{ color }}>
      <ellipse cx="100" cy="40" rx="88" ry="10" fill={color} />
      <ellipse cx="186" cy="40" rx="6" ry="7" fill={color} />
      {/* S-duct tail engine */}
      <ellipse cx="20" cy="26" rx="10" ry="4" fill={color} opacity="0.85" />
      <rect x="20" y="26" width="4" height="14" fill={color} opacity="0.85" />
      {/* Vertical tail */}
      <polygon points="18,40 18,18 36,32" fill={color} />
      {/* Horizontal stabilizer */}
      <polygon points="18,38 18,42 40,32 40,48" fill={color} />
      {/* Wings - swept */}
      <polygon points="115,40 112,44 68,60 62,54 110,38" fill={color} />
      <polygon points="115,40 112,36 68,20 62,26 110,42" fill={color} />
      {/* 2 underwing engines */}
      <ellipse cx="86" cy="62" rx="11" ry="4" fill={color} opacity="0.85" />
      <ellipse cx="86" cy="20" rx="11" ry="4" fill={color} opacity="0.85" />
      {[145,155,165,175].map(x => (
        <rect key={x} x={x} y="37" width="5" height="5" fill="white" opacity="0.4" />
      ))}
    </svg>
  );
}
