import React from 'react';
import type { SpaceWeatherResponse } from '../types.js';

interface SpaceWeatherCardProps {
  data: SpaceWeatherResponse | null;
  isLoading?: boolean;
  onOpenRadiationGuide?: () => void;
}

export const SpaceWeatherCard: React.FC<SpaceWeatherCardProps> = ({
  data,
  isLoading = false,
  onOpenRadiationGuide,
}) => {
  const isAvailable = data?.available === true;
  const hasStrongEvent = isAvailable && data?.has_strong_event === true;

  const topFlare = data?.flares && data.flares.length > 0 ? data.flares[0] : null;
  const topCme = data?.cmes && data.cmes.length > 0 ? data.cmes[0] : null;

  return (
    <section className="space-weather-card" aria-label="Space Weather Telemetry">
      <div className="sw-header">
        <div className="sw-title-wrap">
          <span className="section-label">HELIOSPHERIC TELEMETRY</span>
          <h3 className="sw-title">Space Weather // NASA DONKI</h3>
        </div>

        <div className="sw-status-badge">
          {!isAvailable ? (
            <span className="sw-pill sw-pill-offline">
              <span className="symbol" aria-hidden="true">■</span> FEED OFFLINE
            </span>
          ) : hasStrongEvent ? (
            <span className="sw-pill sw-pill-advisory" role="status">
              <span className="symbol" aria-hidden="true">▲</span> ADVISORY ACTIVE
            </span>
          ) : (
            <span className="sw-pill sw-pill-quiet" role="status">
              <span className="symbol" aria-hidden="true">●</span> SOLAR QUIET
            </span>
          )}
        </div>
      </div>

      {isLoading && !data && (
        <div className="sw-body">
          <p className="sw-text-muted">Querying NASA DONKI space weather feed...</p>
        </div>
      )}

      {!isLoading && !isAvailable && (
        <div className="sw-body">
          <p className="sw-text-muted">
            Space weather telemetry feed offline or rate-limited. Onboard clinical decision support continues nominal.
          </p>
        </div>
      )}

      {isAvailable && (
        <div className="sw-body">
          {hasStrongEvent && (
            <div className="sw-advisory-box" role="alert">
              <div className="sw-advisory-header">
                <span className="sw-advisory-tag">SOLAR PARTICLE EVENT ADVISORY</span>
              </div>
              <p className="sw-advisory-text">
                {data.advisory ?? 'High-energy solar flare or fast CME detected.'}
              </p>
              {onOpenRadiationGuide && (
                <button
                  type="button"
                  className="btn-sw-guide"
                  onClick={onOpenRadiationGuide}
                  aria-label="View Radiation SPE Shelter Guide"
                >
                  View Radiation SPE Shelter Guide (radiation-spe-shelter.md)
                </button>
              )}
              <span className="sw-disclaimer">
                Decision support only. Space weather advisories do not change rules engine health levels.
              </span>
            </div>
          )}

          <div className="sw-metrics-grid">
            <div className="sw-metric-col">
              <span className="sw-metric-label">SOLAR FLARES (7D)</span>
              <span className="sw-metric-val tabular">
                {data.flares ? data.flares.length : 0}{' '}
                {topFlare ? (
                  <span className="sw-metric-sub">
                    (Peak: {topFlare.classType})
                  </span>
                ) : (
                  <span className="sw-metric-sub">(None)</span>
                )}
              </span>
            </div>

            <div className="sw-metric-col">
              <span className="sw-metric-label">CORONAL MASS EJECTIONS</span>
              <span className="sw-metric-val tabular">
                {data.cmes ? data.cmes.length : 0}{' '}
                {topCme?.speed ? (
                  <span className="sw-metric-sub">
                    (Top: {topCme.speed} km/s)
                  </span>
                ) : (
                  <span className="sw-metric-sub">(None)</span>
                )}
              </span>
            </div>
          </div>

          <div className="sw-footer">
            <span className="sw-sync-info tabular">
              {data.cached ? 'DONKI Cache' : 'DONKI Live'}
              {data.last_updated ? ` // ${data.last_updated.substring(11, 16)} UTC` : ''}
            </span>
          </div>
        </div>
      )}
    </section>
  );
};

