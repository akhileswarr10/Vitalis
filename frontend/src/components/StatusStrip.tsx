import React from 'react';
import type { Level } from '../types.js';
import { StatusIndicator } from './StatusIndicator.js';

interface StatusStripProps {
  astronautId: string;
  overall: Level | undefined;
  multiDomain: boolean;
  lastSyncTime?: string;
  isOffline?: boolean;
  queuedCount?: number;
  onSeedDemo?: () => void;
  isSeeding?: boolean;
  onCopyReport?: () => void;
  onDownloadReport?: () => void;
  onSyncNow?: () => void;
  isSyncing?: boolean;
  reportFeedback?: string | null;
}

export const StatusStrip: React.FC<StatusStripProps> = ({
  astronautId,
  overall,
  multiDomain,
  lastSyncTime,
  isOffline = false,
  queuedCount = 0,
  onSeedDemo,
  isSeeding = false,
  onCopyReport,
  onDownloadReport,
  onSyncNow,
  isSyncing = false,
  reportFeedback,
}) => {
  const syncLabel = isOffline
    ? `Last synced ${lastSyncTime || 'N/A'}, offline`
    : lastSyncTime
      ? `Synced: ${lastSyncTime}`
      : 'Telemetry: Live';

  return (
    <header className="status-strip" role="banner">
      {/* Mandatory medical disclaimer banner on every screen (RESTRICTIONS.md §1) */}
      <div className="disclaimer-bar">
        <span className="disclaimer-text">
          Decision support only. Not a medical device. Ground flight surgeon approval required for clinical actions.
        </span>
      </div>

      <div className="telemetry-bar">
        <div className="telemetry-left">
          <div className="console-id">
            <span className="console-label">CONSOLE</span>
            <span className="console-title tabular">VITALIS // {astronautId.toUpperCase()}</span>
          </div>

          <div className="status-overall-wrap">
            <span className="section-label">OVERALL STATUS</span>
            <StatusIndicator level={overall} size="lg" />
          </div>

          {multiDomain && (
            <div className="multi-domain-alert" role="alert">
              <span className="alert-symbol" aria-hidden="true">▲</span>
              <span className="alert-text">Multi-domain elevation: 2+ domains flagged</span>
            </div>
          )}

          {isOffline && (
            <div className="offline-pill" role="status" aria-label="Offline telemetry indicator">
              <span className="pill-dot" aria-hidden="true">■</span>
              <span>OFFLINE TELEMETRY</span>
            </div>
          )}
        </div>

        <div className="telemetry-right">
          <div className="sync-status">
            <span className="section-label">TELEMETRY SYNC</span>
            <span className="sync-time tabular" data-testid="sync-time-label">
              {syncLabel}
            </span>
          </div>

          {queuedCount > 0 && onSyncNow && (
            <button
              type="button"
              className="btn-sync"
              onClick={onSyncNow}
              disabled={isSyncing}
              aria-label={`Sync ${queuedCount} queued check-ins`}
            >
              {isSyncing ? 'Syncing...' : `Sync (${queuedCount} Queued)`}
            </button>
          )}

          <div className="report-action-group" role="group" aria-label="Ground Report Actions">
            {onCopyReport && (
              <button
                type="button"
                className="btn-action"
                onClick={onCopyReport}
                aria-label="Copy plain-text ground report to clipboard"
              >
                Copy Report
              </button>
            )}

            {onDownloadReport && (
              <button
                type="button"
                className="btn-action"
                onClick={onDownloadReport}
                aria-label="Download plain-text ground telemetry report"
              >
                Download Report
              </button>
            )}

            {reportFeedback && (
              <span className="report-feedback" role="status" aria-live="polite">
                {reportFeedback}
              </span>
            )}
          </div>

          {onSeedDemo && (
            <button
              type="button"
              className="btn-seed"
              onClick={onSeedDemo}
              disabled={isSeeding}
              aria-label="Load 30-day synthetic demo flight data"
            >
              {isSeeding ? 'Seeding...' : 'Load 30d Demo Data'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
