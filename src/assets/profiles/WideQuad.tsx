interface Props { color?: string; className?: string }

export function WideQuad({ color = 'currentColor', className }: Props) {
  return (
    <svg viewBox="0 0 200 80" className={className} style={{ color }}>
      {/* Wide fuselage + 747 upper-deck hump */}
      <ellipse cx="100" cy="40" rx="87" ry="13" fill={color} />
      {/* Upper deck hump (747-style) */}
      <ellipse cx="148" cy="30" rx="30" ry="8" fill={color} />
      <ellipse cx="185" cy="40" rx="7" ry="9" fill={color} />
      <polygon points="13,40 27,29 27,51" fill={color} />
      <polygon points="18,40 18,10 44,28" fill={color} />
      <polygon points="16,36 16,44 48,24 48,56" fill={color} />
      {/* Very long swept wings */}
      <polygon points="118,40 115,47 58,64 50,58 112,38" fill={color} />
      <polygon points="118,40 115,33 58,16 50,22 112,42" fill={color} />
      {/* 4 engines under wings */}
      <ellipse cx="90" cy="67" rx="14" ry="5" fill={color} opacity="0.85" />
      <ellipse cx="72" cy="72" rx="12" ry="5" fill={color} opacity="0.85" />
      <ellipse cx="90" cy="14" rx="14" ry="5" fill={color} opacity="0.85" />
      <ellipse cx="72" cy="9" rx="12" ry="5" fill={color} opacity="0.85" />
      {[145,155,165,175].map(x => (
        <rect key={x} x={x} y="36" width="6" height="7" fill="white" opacity="0.4" />
      ))}
    </svg>
  );
}
