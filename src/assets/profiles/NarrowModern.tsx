interface Props { color?: string; className?: string }

export function NarrowModern({ color = 'currentColor', className }: Props) {
  return (
    <svg viewBox="0 0 200 80" className={className} style={{ color }}>
      <ellipse cx="100" cy="40" rx="87" ry="10" fill={color} />
      <ellipse cx="185" cy="40" rx="7" ry="7" fill={color} />
      <polygon points="14,40 28,32 28,48" fill={color} />
      {/* Vertical tail */}
      <polygon points="20,40 20,16 42,32" fill={color} />
      {/* Horizontal stabilizer */}
      <polygon points="18,38 18,42 44,30 44,50" fill={color} />
      {/* Swept wings with winglets */}
      <polygon points="118,40 115,45 72,58 66,54 112,38" fill={color} />
      <polygon points="118,40 115,35 72,22 66,26 112,42" fill={color} />
      {/* Winglets */}
      <line x1="66" y1="54" x2="62" y2="48" stroke={color} strokeWidth="3" />
      <line x1="66" y1="26" x2="62" y2="32" stroke={color} strokeWidth="3" />
      {/* 2 pod engines under wings */}
      <ellipse cx="88" cy="61" rx="13" ry="5" fill={color} opacity="0.85" />
      <ellipse cx="88" cy="20" rx="13" ry="5" fill={color} opacity="0.85" />
      {[145,155,165,175].map(x => (
        <rect key={x} x={x} y="37" width="5" height="5" fill="white" opacity="0.4" />
      ))}
    </svg>
  );
}
