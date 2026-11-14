import React, { useEffect, useState, useCallback } from 'react';
import './tokens.css';
import './App.css';
import { api } from './api/client.js';
import type {
  Domain,
  StatusResponse,
  TrendPoint,
  CheckInCreate,
  SpaceWeatherResponse,
} from './types.js';
import { StatusStrip } from './components/StatusStrip.js';
import { DomainRow } from './components/DomainRow.js';
import { SelectedDomainDetail } from './components/SelectedDomainDetail.js';
import { CheckInForm } from './components/CheckInForm.js';
import { AssistantPanel } from './components/AssistantPanel.js';
import { SpaceWeatherCard } from './components/SpaceWeatherCard.js';
import {
  queueCheckIn,
  getQueuedCount,
  saveCachedStatus,
  getCachedStatus,
  syncQueuedCheckIns,
} from './db/offlineDb.js';
import { generateClientReport } from './utils/offlineReport.js';

const DOMAINS: Domain[] = ['cardio', 'msk', 'immune', 'behav', 'env'];
const ASTRONAUT_ID = 'crew-01';

export default function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [trends, setTrends] = useState<Record<string, TrendPoint[]>>({});
  const [selectedDomain, setSelectedDomain] = useState<Domain>('cardio');
  const [expandedDomain, setExpandedDomain] = useState<Domain | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'assistant' | 'checkin'>('dashboard');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | undefined>(undefined);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [queuedCount, setQueuedCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [spaceWeather, setSpaceWeather] = useState<SpaceWeatherResponse | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch current health status
      const statusData = await api.getStatus(ASTRONAUT_ID);
      setStatus(statusData);

      // Space weather (fails soft, does not block health telemetry)
      api.getSpaceWeather()
        .then(sw => setSpaceWeather(sw))
        .catch(() => setSpaceWeather({ available: false }));

      // 2. Fetch history to build sparkline trends
      const checkIns = await api.getCheckIns(ASTRONAUT_ID);
      const trendMap: Record<string, TrendPoint[]> = {};

      for (const ci of checkIns) {
        for (const key of Object.keys(ci)) {
          if (key === 'id' || key === 'astronaut_id' || key === 'created_at' || key === 'day') {
            continue;
          }
          const val = ci[key as keyof typeof ci];
          if (typeof val === 'number') {
            if (!trendMap[key]) trendMap[key] = [];
            trendMap[key].push({ day: ci.day, value: val });
          }
        }
      }
      setTrends(trendMap);

      const now = new Date();
      const syncTimeStr = `${now.toISOString().substring(11, 16)} UTC`;
      setLastSyncTime(syncTimeStr);
      setIsOffline(false);

      // Cache status in Dexie for offline degradation
      await saveCachedStatus(ASTRONAUT_ID, statusData, syncTimeStr);

      // Check and sync any queued check-ins from previous offline sessions
      const count = await getQueuedCount(ASTRONAUT_ID);
      setQueuedCount(count);
      if (count > 0) {
        setIsSyncing(true);
        const { syncedCount } = await syncQueuedCheckIns(ASTRONAUT_ID, api.addCheckIn);
        setIsSyncing(false);
        const remaining = await getQueuedCount(ASTRONAUT_ID);
        setQueuedCount(remaining);
        if (syncedCount > 0) {
          const refreshed = await api.getStatus(ASTRONAUT_ID);
          setStatus(refreshed);
        }
      }
    } catch (err) {
      // Degradation: fallback to Dexie cached status
      const cached = await getCachedStatus(ASTRONAUT_ID);
      if (cached) {
        setStatus(cached.status);
        setLastSyncTime(cached.lastSyncedAt);
        setIsOffline(true);
        setError(null);
      } else {
        setIsOffline(true);
        setError(err instanceof Error ? err.message : 'Telemetry offline. Unable to reach backend.');
      }
      const count = await getQueuedCount(ASTRONAUT_ID);
      setQueuedCount(count);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Online / offline network listeners for automatic sync
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      void (async () => {
        setIsSyncing(true);
        const { syncedCount } = await syncQueuedCheckIns(ASTRONAUT_ID, api.addCheckIn);
        setIsSyncing(false);
        const remaining = await getQueuedCount(ASTRONAUT_ID);
        setQueuedCount(remaining);
        if (syncedCount > 0) {
          await loadData();
        }
      })();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData]);

  const handleSyncQueued = async () => {
    setIsSyncing(true);
    try {
      const { syncedCount } = await syncQueuedCheckIns(ASTRONAUT_ID, api.addCheckIn);
      const remaining = await getQueuedCount(ASTRONAUT_ID);
      setQueuedCount(remaining);
      if (syncedCount > 0) {
        await loadData();
      }
    } catch {
      // Still offline
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSeedDemo = async () => {
    setIsSeeding(true);
    try {
      await api.seedDemo();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo seed failed');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleCheckInSubmit = async (data: CheckInCreate) => {
    try {
      if (isOffline) {
        throw new Error('Offline telemetry active');
      }
      await api.addCheckIn(ASTRONAUT_ID, data);
      setSubmissionNotice(`Check-in for Day ${data.day} submitted and synchronized.`);
      await loadData();
    } catch {
      // Backend unreachable or network offline: queue in Dexie
      await queueCheckIn(ASTRONAUT_ID, data);
      const count = await getQueuedCount(ASTRONAUT_ID);
      setQueuedCount(count);
      setSubmissionNotice(
        `Offline: check-in queued for Day ${data.day}. Will sync when connection is restored.`,
      );
    }
  };

  const handleCopyReport = async () => {
    let reportText = '';
    try {
      reportText = await api.getReport(ASTRONAUT_ID);
    } catch {
      reportText = generateClientReport(ASTRONAUT_ID, status);
    }
    await navigator.clipboard.writeText(reportText);
    setReportFeedback('Report copied to clipboard');
    setTimeout(() => setReportFeedback(null), 3000);
  };

  const handleDownloadReport = async () => {
    let reportText = '';
    try {
      reportText = await api.getReport(ASTRONAUT_ID);
    } catch {
      reportText = generateClientReport(ASTRONAUT_ID, status);
    }
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vitalis-report-${ASTRONAUT_ID}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setReportFeedback('Report downloaded');
    setTimeout(() => setReportFeedback(null), 3000);
  };

  const handleAskAssistant = async (qText: string) => {
    return await api.askAssistant(ASTRONAUT_ID, qText);
  };

  const handleOpenRadiationGuide = () => {
    setActiveTab('assistant');
  };

  // Find status for a domain
  const getDomainStatus = (dom: Domain) => {
    return status?.domains.find(d => d.domain === dom);
  };

  const selectedDomainStatus = getDomainStatus(selectedDomain);

  return (
    <div className="app-container">
      <StatusStrip
        astronautId={ASTRONAUT_ID}
        overall={status?.overall}
        multiDomain={status?.multi_domain ?? false}
        lastSyncTime={lastSyncTime}
        isOffline={isOffline}
        queuedCount={queuedCount}
        onSeedDemo={handleSeedDemo}
        isSeeding={isSeeding}
        onCopyReport={handleCopyReport}
        onDownloadReport={handleDownloadReport}
        onSyncNow={handleSyncQueued}
        isSyncing={isSyncing}
        reportFeedback={reportFeedback}
      />

      <nav className="nav-strip" role="tablist" aria-label="Console Navigation">
        <button
          type="button"
          className={`nav-tab ${activeTab === 'dashboard' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
          aria-selected={activeTab === 'dashboard'}
          role="tab"
        >
          Telemetry Dashboard
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'assistant' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('assistant')}
          aria-selected={activeTab === 'assistant'}
          role="tab"
        >
          AI Health Assistant
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'checkin' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('checkin')}
          aria-selected={activeTab === 'checkin'}
          role="tab"
        >
          + Log Check-In {queuedCount > 0 ? `(${queuedCount} queued)` : ''}
        </button>
      </nav>

      {submissionNotice && (
        <div className="submission-notice" role="status" aria-live="polite">
          <span>{submissionNotice}</span>
          <button
            type="button"
            className="notice-dismiss"
            onClick={() => setSubmissionNotice(null)}
            aria-label="Dismiss notice"
          >
            [close]
          </button>
        </div>
      )}

      {error && !status && (
        <div className="state-panel" role="alert" style={{ color: 'var(--status-action)' }}>
          <p>{error}</p>
          <button
            type="button"
            className="btn-seed"
            onClick={loadData}
            style={{ marginTop: '8px' }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {isLoading && !status && !error && (
        <div className="state-panel">
          <p>Loading flight telemetry...</p>
        </div>
      )}

      {status && (
        <main className="main-content">
          <section className="col-primary" aria-label="Telemetry Domains">
            {DOMAINS.map(dom => (
              <DomainRow
                key={dom}
                domain={dom}
                status={getDomainStatus(dom)}
                trends={trends}
                isExpanded={expandedDomain === dom}
                onToggleExpand={() =>
                  setExpandedDomain(prev => (prev === dom ? null : dom))
                }
                isSelected={selectedDomain === dom}
                onSelect={() => setSelectedDomain(dom)}
              />
            ))}

            <SpaceWeatherCard
              data={spaceWeather}
              onOpenRadiationGuide={handleOpenRadiationGuide}
            />
          </section>

          <section className="col-secondary" aria-label="Detail Working Panel">
            {activeTab === 'assistant' ? (
              <AssistantPanel
                astronautId={ASTRONAUT_ID}
                flaggedDomains={status?.domains}
                onAsk={handleAskAssistant}
              />
            ) : activeTab === 'checkin' ? (
              <CheckInForm
                initialDay={(status?.entry_count ?? 0) + 1}
                onSubmit={handleCheckInSubmit}
              />
            ) : (
              <SelectedDomainDetail
                domain={selectedDomain}
                status={selectedDomainStatus}
                trends={trends}
              />
            )}
          </section>
        </main>
      )}
    </div>
  );
}
