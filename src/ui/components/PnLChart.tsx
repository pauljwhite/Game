import React, { useRef, useEffect } from 'react';
import type { DailySnapshot } from '@/types';

interface PnLChartProps {
  snapshots: DailySnapshot[];
  width?: number;
  height?: number;
  isDark?: boolean;
}

export const PnLChart: React.FC<PnLChartProps> = ({ snapshots, width = 300, height = 80, isDark = true }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bg       = isDark ? '#1f2937' : '#f1f5f9';
    const emptyBg  = isDark ? '#374151' : '#e2e8f0';
    const emptyTxt = isDark ? '#6b7280' : '#94a3b8';
    const zeroDash = isDark ? '#374151' : '#cbd5e1';

    ctx.clearRect(0, 0, width, height);

    if (snapshots.length < 2) {
      ctx.fillStyle = emptyBg;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = emptyTxt;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data yet', width / 2, height / 2 + 4);
      return;
    }

    const profits = snapshots.map(s => s.profit);
    const min = Math.min(...profits);
    const max = Math.max(...profits);
    const range = max - min || 1;

    const pad = { top: 8, bottom: 8, left: 4, right: 4 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;

    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Zero line
    const zeroY = pad.top + chartH - ((0 - min) / range) * chartH;
    ctx.strokeStyle = zeroDash;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(pad.left, zeroY);
    ctx.lineTo(width - pad.right, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sparkline
    ctx.beginPath();
    ctx.lineWidth = 1.5;
    snapshots.forEach((s, i) => {
      const x = pad.left + (i / (snapshots.length - 1)) * chartW;
      const y = pad.top + chartH - ((s.profit - min) / range) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    const lastProfit = profits[profits.length - 1] ?? 0;
    ctx.strokeStyle = lastProfit >= 0 ? '#22c55e' : '#ef4444';
    ctx.stroke();

    // Fill under line
    const lastX = pad.left + chartW;
    ctx.lineTo(lastX, zeroY);
    ctx.lineTo(pad.left, zeroY);
    ctx.closePath();
    ctx.fillStyle = lastProfit >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';
    ctx.fill();
  }, [snapshots, width, height, isDark]);

  return <canvas ref={canvasRef} width={width} height={height} className="block w-full rounded" style={{ height }} />;
};
