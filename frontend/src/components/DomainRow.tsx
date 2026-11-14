import React from 'react';
import type { Domain, DomainStatus, TrendPoint } from '../types.js';
import { DOMAIN_LABELS, METRIC_LABELS } from '../types.js';
import { StatusIndicator } from './StatusIndicator.js';
import { Sparkline } from './Sparkline.js';

interface DomainRowProps {
  domain: Domain;
  status: DomainStatus | undefined;
  trends?: Record<string, TrendPoint[]>;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isSelected?: boolean;
  onSelect?: () => void;
}

export const DomainRow: React.FC<DomainRowProps> = ({
  domain,
  status,
  trends = {},
  isExpanded,
  onToggleExpand,
  isSelected = false,
  onSelect,
}) => {
  const domainLabel = DOMAIN_LABELS[domain];
  const level = status?.level;
  const metrics = status?.metrics ?? [];

  // Determine primary metric for sparkline display
  const primaryMetricKey = metrics[0]?.key ?? '';
  const primaryTrend = primaryMetricKey ? trends[primaryMetricKey] ?? [] : [];

  // Build one-line reason summary
  const elevatedMetrics = metrics.filter(m => m.level >= 1);
  const driftMetrics = metrics.filter(m => m.drift !== undefined);

  let summaryReason = 'All metrics within nominal range.';
  if (!status || metrics.length === 0) {
    summaryReason = 'No telemetry recorded. Submit a check-in.';
  } else if (level === 2) {
    const names = elevatedMetrics.map(m => METRIC_LABELS[m.key]?.label ?? m.key).join(', ');
    summaryReason = `Critical action threshold reached for: ${names}`;
  } else if (level === 1) {
    const names = elevatedMetrics.map(m => METRIC_LABELS[m.key]?.label ?? m.key).join(', ');
    summaryReason = `Watch boundary reached for: ${names}`;
  } else if (driftMetrics.length > 0) {
    const names = driftMetrics.map(m => METRIC_LABELS[m.key]?.label ?? m.key).join(', ');
    summaryReason = `Telemetry drift flagged for: ${names}`;
  }

  // Row status styling: Level 2 uses heavier border and inverted label (DESIGN.md)
  let rowLevelClass = 'row-nominal';
  if (level === 1) rowLevelClass = 'row-watch';
  if (level === 2) rowLevelClass = 'row-action';
  if (level === undefined) rowLevelClass = 'row-nodata';

  return (
    <div
      className={`domain-row ${rowLevelClass} ${isSelected ? 'is-selected' : ''} ${isExpanded ? 'is-expanded' : ''
        }`}
      data-testid={`domain-row-${domain}`}
    >
      <div className="domain-row-summary">
        <div className="domain-header-col">
          <button
            type="button"
            className="domain-select-btn"
            onClick={onSelect}
            aria-label={`Select ${domainLabel} domain`}
          >
            <span className="domain-name">{domainLabel}</span>
          </button>
          <StatusIndicator level={level} size="sm" />
        </div>

        <div className="domain-telemetry-grid">
          {metrics.map(m => {
            const meta = METRIC_LABELS[m.key];
            const isElevated = m.level >= 1;
            return (
              <div
                key={m.key}
                className={`metric-chip ${isElevated ? `metric-level-${m.level}` : ''}`}
                title={`${meta?.label ?? m.key}: ${m.value} ${meta?.unit ?? ''}`}
              >
                <span className="metric-chip-label">{meta?.label ?? m.key}</span>
                <span className="metric-chip-value tabular">
                  {m.value}{' '}
                  <span className="metric-chip-unit">{meta?.unit ?? ''}</span>
                </span>
              </div>
            );
          })}
          {metrics.length === 0 && (
            <span className="metric-placeholder">-- no data --</span>
          )}
        </div>

        <div className="domain-sparkline-col">
          <Sparkline
            data={primaryTrend}
            height={32}
            strokeColor={
              level === 2
                ? 'var(--status-action)'
                : level === 1
                  ? 'var(--status-watch)'
                  : 'var(--text-muted)'
            }
          />
        </div>

        <div className="domain-reason-col">
          <span className="reason-text">{summaryReason}</span>
        </div>

        <div className="domain-actions-col">
          <button
            type="button"
            className="btn-expand"
            onClick={e => {
              e.stopPropagation();
              onToggleExpand();
            }}
            aria-expanded={isExpanded}
            aria-controls={`domain-details-${domain}`}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details for ${domainLabel}`}
          >
            {isExpanded ? '▲ Hide' : '▼ Details'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div
          id={`domain-details-${domain}`}
          className="domain-expanded-panel"
          data-testid={`domain-expanded-${domain}`}
        >
          <div className="expanded-section">
            <span className="section-title">METRIC THRESHOLDS & DRIFT</span>
            <div className="thresholds-table">
              <div className="table-header">
                <span>Metric</span>
                <span>Current</span>
                <span>Watch Limit</span>
                <span>Action Limit</span>
                <span>Drift Status</span>
              </div>
              {metrics.map(m => {
                const meta = METRIC_LABELS[m.key];
                return (
                  <div key={m.key} className="table-row">
                    <span className="table-metric-name">{meta?.label ?? m.key}</span>
                    <span className="table-value tabular">
                      {m.value} {meta?.unit ?? ''}
                    </span>
                    <span className="table-limit tabular">
                      {m.effectiveWatch} {meta?.unit ?? ''}
                    </span>
                    <span className="table-limit tabular">
                      {m.effectiveAction} {meta?.unit ?? ''}
                    </span>
                    <span className="table-drift">
                      {m.drift ? (
                        <span className="drift-badge tabular">
                          DRIFT ({m.drift.direction}): {m.drift.last3Mean.toFixed(1)} vs{' '}
                          {m.drift.prev14Mean.toFixed(1)} (tol: {m.drift.tolerance})
                        </span>
                      ) : (
                        <span className="drift-nominal">Nominal</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {status?.actions && status.actions.length > 0 && (
            <div className="expanded-section">
              <span className="section-title">DETERMINISTIC ACTION STEPS</span>
              <ol className="action-steps-list">
                {status.actions.map((act, i) => (
                  <li key={i} className="action-step-item">
                    {act}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
