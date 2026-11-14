import React from 'react';
import { LineChart, Line, ResponsiveContainer, ReferenceLine, YAxis } from 'recharts';
import type { TrendPoint } from '../types.js';

interface SparklineProps {
  data: TrendPoint[];
  baseline?: number | null;
  height?: number;
  width?: number | string;
  strokeColor?: string;
  metricKey?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  baseline,
  height = 36,
  strokeColor = 'var(--text-muted)',
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="sparkline-empty" aria-hidden="true">
        <span className="sparkline-nodata">--</span>
      </div>
    );
  }

  // Find min and max for clean padding
  const values = data.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const padding = (maxVal - minVal) * 0.15 || 2;
  const domainMin = Math.floor(minVal - padding);
  const domainMax = Math.ceil(maxVal + padding);

  const lastIndex = data.length - 1;

  return (
    <div className="sparkline-container" style={{ height }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 6, bottom: 4, left: 6 }}>
          <YAxis domain={[domainMin, domainMax]} hide />

          {baseline !== undefined && baseline !== null && (
            <ReferenceLine
              y={baseline}
              stroke="var(--text-dim)"
              strokeDasharray="2 2"
              strokeWidth={1}
            />
          )}

          <Line
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={1.5}
            dot={(props: { index?: number; cx?: number; cy?: number }) => {
              // Only render dot on the latest value (DESIGN.md)
              if (props.index === lastIndex && props.cx !== undefined && props.cy !== undefined) {
                return (
                  <circle
                    key={`dot-${props.index}`}
                    cx={props.cx}
                    cy={props.cy}
                    r={3}
                    fill={strokeColor}
                    stroke="var(--bg-surface)"
                    strokeWidth={1}
                  />
                );
              }
              return <React.Fragment key={`empty-${props.index ?? 0}`} />;
            }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

