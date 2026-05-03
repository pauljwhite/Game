interface Props { color?: string; className?: string }

export function NarrowRearTwin({ color = 'currentColor', className }: Props) {
  return (
    <svg viewBox="0 0 200 80" className={className} style={{ color }}>
      <ellipse cx="100" cy="40" rx="86" ry="10" fill={color} />
      <ellipse cx="184" cy="40" rx="6" ry="7" fill={color} />
      {/* Vertical tail */}
      <polygon points="18,40 18,15 40,32" fill={color} />
      {/* Horizontal stabilizer (smaller, high) */}
      <polygon points="18,36 18,42 46,28 46,46" fill={color} />
      {/* Swept wings - clean, no underwing engines */}
      <polygon points="120,40 116,45 74,55 70,50 115,38" fill={color} />
      <polygon points="120,40 116,35 74,25 70,30 115,42" fill={color} />
      {/* 2 rear-mounted engines on tail sides */}
      <ellipse cx="36" cy="31" rx="12" ry="5" fill={color} opacity="0.85" />
      <ellipse cx="36" cy="49" rx="12" ry="5" fill={color} opacity="0.85" />
      {[145,155,165,175].map(x => (
        <rect key={x} x={x} y="37" width="5" height="5" fill="white" opacity="0.4" />
      ))}
    </svg>
  );
}
