import React from 'react';
import type { Domain, DomainStatus, TrendPoint } from '../types.js';
import { DOMAIN_LABELS, METRIC_LABELS } from '../types.js';
import { StatusIndicator } from './StatusIndicator.js';
import { Sparkline } from './Sparkline.js';

interface SelectedDomainDetailProps {
  domain: Domain;
  status: DomainStatus | undefined;
  trends?: Record<string, TrendPoint[]>;
}

export const SelectedDomainDetail: React.FC<SelectedDomainDetailProps> = ({
  domain,
  status,
  trends = {},
}) => {
  const domainLabel = DOMAIN_LABELS[domain];
  const level = status?.level;
  const metrics = status?.metrics ?? [];

  return (
    <div className="domain-detail-card" data-testid="selected-domain-detail">
      <div className="detail-header">
        <div className="detail-title-wrap">
          <span className="section-label">TELEMETRY DETAIL</span>
          <h2 className="detail-domain-name">{domainLabel.toUpperCase()}</h2>
        </div>
        <StatusIndicator level={level} size="md" />
      </div>

      <div className="detail-metrics-list">
        {metrics.map(m => {
          const meta = METRIC_LABELS[m.key];
          const mTrend = trends[m.key] ?? [];
          const isElevated = m.level >= 1;

          return (
            <div
              key={m.key}
              className={`detail-metric-card ${isElevated ? `level-${m.level}` : ''}`}
            >
              <div className="metric-header-row">
                <span className="metric-name">{meta?.label ?? m.key}</span>
                <span className="metric-current tabular">
                  {m.value}{' '}
                  <span className="unit-label">{meta?.unit ?? ''}</span>
                </span>
              </div>

              <div className="metric-thresholds-row">
                <span className="threshold-tag">
                  Watch: <strong className="tabular">{m.effectiveWatch}</strong> {meta?.unit ?? ''}
                </span>
                <span className="threshold-tag">
                  Action: <strong className="tabular">{m.effectiveAction}</strong> {meta?.unit ?? ''}
                </span>
                {m.drift && (
                  <span className="drift-tag">
                    Drift ({m.drift.direction}): {m.drift.last3Mean.toFixed(1)} vs{' '}
                    {m.drift.prev14Mean.toFixed(1)}
                  </span>
                )}
              </div>

              <div className="metric-sparkline-row">
                <Sparkline
                  data={mTrend}
                  height={40}
                  strokeColor={
                    m.level === 2
                      ? 'var(--status-action)'
                      : m.level === 1
                      ? 'var(--status-watch)'
                      : 'var(--accent)'
                  }
                />
              </div>
            </div>
          );
        })}

        {metrics.length === 0 && (
          <p className="empty-message">No telemetry data recorded for this domain yet.</p>
        )}
      </div>

      {status?.actions && status.actions.length > 0 && (
        <div className="detail-actions-section">
          <span className="section-label">RECOMMENDED FLIGHT ACTIONS</span>
          <ol className="actions-list">
            {status.actions.map((act, i) => (
              <li key={i} className="action-item">
                {act}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

