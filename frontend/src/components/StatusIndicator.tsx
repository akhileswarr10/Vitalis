import React from 'react';
import type { Level } from '../types.js';

interface StatusIndicatorProps {
  level: Level | undefined;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

/**
 * Status is NEVER conveyed by color alone (DESIGN.md § Color & Type):
 * Nominal = ● filled circle
 * Watch   = ▲ filled triangle
 * Action  = ◼ filled square + heavier border / inverted label
 * No Data = ○ hollow circle
 */
export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  level,
  size = 'md',
  showLabel = true,
}) => {
  let label = 'No data';
  let symbol = '○';
  let statusClass = 'status-nodata';

  if (level === 0) {
    label = 'Nominal';
    symbol = '●';
    statusClass = 'status-nominal';
  } else if (level === 1) {
    label = 'Watch';
    symbol = '▲';
    statusClass = 'status-watch';
  } else if (level === 2) {
    label = 'Action needed';
    symbol = '◼';
    statusClass = 'status-action';
  }

  return (
    <span
      className={`status-indicator ${statusClass} size-${size}`}
      role="status"
      aria-label={`Status: ${label}`}
    >
      <span className="symbol" aria-hidden="true">
        {symbol}
      </span>
      {showLabel && <span className="label-text">{label}</span>}
    </span>
  );
};

