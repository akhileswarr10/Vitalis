import React, { useState } from 'react';
import type { CheckInCreate } from '../types.js';

interface CheckInFormProps {
  initialDay?: number;
  onSubmit: (data: CheckInCreate) => Promise<void>;
  isSubmitting?: boolean;
}

interface FieldConfig {
  key: keyof CheckInCreate;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  domain: string;
  isInteger: boolean;
}

const FIELDS: FieldConfig[] = [
  // Cardio
  { key: 'hr', label: 'Resting Heart Rate', unit: 'bpm', min: 30, max: 200, step: 1, domain: 'Cardiovascular', isInteger: true },
  { key: 'sbp', label: 'Systolic Blood Pressure', unit: 'mmHg', min: 60, max: 220, step: 1, domain: 'Cardiovascular', isInteger: true },
  { key: 'ortho', label: 'Orthostatic HR Rise', unit: 'bpm', min: 0, max: 80, step: 1, domain: 'Cardiovascular', isInteger: true },
  // MSK
  { key: 'ex', label: 'Countermeasure Exercise', unit: 'min', min: 0, max: 480, step: 1, domain: 'Musculoskeletal', isInteger: true },
  { key: 'bone', label: 'Bone Density Index', unit: '0–10', min: 0, max: 10, step: 1, domain: 'Musculoskeletal', isInteger: true },
  // Immune
  { key: 'temp', label: 'Core Body Temperature', unit: '°C', min: 34.0, max: 42.0, step: 0.1, domain: 'Immune', isInteger: false },
  { key: 'sym', label: 'Symptom Score', unit: '0–6', min: 0, max: 6, step: 1, domain: 'Immune', isInteger: true },
  // Behavioral
  { key: 'sleep', label: 'Sleep Duration', unit: 'hours', min: 0.0, max: 16.0, step: 0.1, domain: 'Behavioral', isInteger: false },
  { key: 'mood', label: 'Mood Score', unit: '1–10', min: 1, max: 10, step: 1, domain: 'Behavioral', isInteger: true },
  { key: 'stress', label: 'Perceived Stress Score', unit: '0–10', min: 0, max: 10, step: 1, domain: 'Behavioral', isInteger: true },
  // Environmental
  { key: 'dose', label: 'Radiation Dose Rate', unit: 'mGy/d', min: 0.0, max: 100.0, step: 0.01, domain: 'Environmental', isInteger: false },
  { key: 'co2', label: 'Cabin CO₂ Partial Pressure', unit: 'ppm', min: 300, max: 10000, step: 1, domain: 'Environmental', isInteger: true },
];

export const CheckInForm: React.FC<CheckInFormProps> = ({
  initialDay = 1,
  onSubmit,
  isSubmitting = false,
}) => {
  const [day, setDay] = useState<number>(initialDay);
  const [values, setValues] = useState<Partial<Record<keyof CheckInCreate, string>>>({
    hr: '68',
    sbp: '118',
    ortho: '12',
    ex: '75',
    bone: '8',
    temp: '36.7',
    sym: '0',
    sleep: '7.4',
    mood: '8',
    stress: '3',
    dose: '0.40',
    co2: '580',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CheckInCreate | 'day', string>>>({});
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const validateField = (key: keyof CheckInCreate, valStr: string): string | null => {
    const config = FIELDS.find(f => f.key === key);
    if (!config) return null;

    if (!valStr || valStr.trim() === '') {
      return `Required. Allowed range: ${config.min}–${config.max} ${config.unit}`;
    }

    const val = Number(valStr);
    if (Number.isNaN(val)) {
      return `Invalid number. Allowed range: ${config.min}–${config.max} ${config.unit}`;
    }

    if (config.isInteger && !Number.isInteger(val)) {
      return `Must be an integer between ${config.min} and ${config.max}`;
    }

    if (val < config.min || val > config.max) {
      return `Out of range (${val}). Must be between ${config.min} and ${config.max} ${config.unit}`;
    }

    return null;
  };

  const handleInputChange = (key: keyof CheckInCreate, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
    const err = validateField(key, value);
    setErrors(prev => ({ ...prev, [key]: err ?? undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmation(null);

    const newErrors: Partial<Record<keyof CheckInCreate | 'day', string>> = {};

    // Validate day
    if (!day || day < 1 || !Number.isInteger(day)) {
      newErrors.day = 'Day must be an integer >= 1';
    }

    // Validate all metrics
    const payload: Partial<CheckInCreate> = { day };
    for (const field of FIELDS) {
      const valStr = values[field.key] ?? '';
      const err = validateField(field.key, valStr);
      if (err) {
        newErrors[field.key] = err;
      } else {
        payload[field.key] = Number(valStr) as never;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await onSubmit(payload as CheckInCreate);
      setConfirmation(`Check-in logged successfully for Day ${day}.`);
      setDay(prev => prev + 1);
    } catch (err) {
      setErrors({ day: err instanceof Error ? err.message : 'Failed to submit check-in' });
    }
  };

  // Group fields by domain for clean dense grid display
  const domains = Array.from(new Set(FIELDS.map(f => f.domain)));

  return (
    <form className="checkin-form" onSubmit={handleSubmit} noValidate>
      <div className="form-header">
        <h2 className="form-title">DAILY CREW CHECK-IN TELEMETRY</h2>
        <span className="form-subtitle">All metrics are validated against flight-rule ranges.</span>
      </div>

      {confirmation && (
        <div className="form-confirmation" role="status">
          <span className="confirmation-text">{confirmation}</span>
        </div>
      )}

      {/* Flight Day Selector */}
      <div className="form-day-row">
        <label htmlFor="input-day" className="day-label">
          MISSION FLIGHT DAY
        </label>
        <div className="day-input-wrap">
          <input
            id="input-day"
            type="number"
            min={1}
            step={1}
            value={day}
            onChange={e => {
              const d = parseInt(e.target.value, 10);
              setDay(Number.isNaN(d) ? 1 : d);
            }}
            className="input-text tabular"
            required
            aria-invalid={!!errors.day}
            aria-describedby={errors.day ? 'error-day' : undefined}
          />
          <span className="input-hint">Day &gt;= 1</span>
        </div>
        {errors.day && (
          <span id="error-day" className="field-error" role="alert">
            {errors.day}
          </span>
        )}
      </div>

      {/* Grouped telemetry inputs */}
      <div className="domains-container">
        {domains.map(dom => {
          const domFields = FIELDS.filter(f => f.domain === dom);
          return (
            <fieldset key={dom} className="domain-fieldset">
              <legend className="fieldset-legend">{dom.toUpperCase()}</legend>
              <div className="fields-grid">
                {domFields.map(field => {
                  const val = values[field.key] ?? '';
                  const err = errors[field.key];
                  const inputId = `input-${field.key}`;
                  const errorId = `error-${field.key}`;

                  return (
                    <div key={field.key} className={`form-field ${err ? 'has-error' : ''}`}>
                      <label htmlFor={inputId} className="field-label">
                        {field.label}
                      </label>
                      <div className="input-with-unit">
                        <input
                          id={inputId}
                          type="number"
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          value={val}
                          onChange={e => handleInputChange(field.key, e.target.value)}
                          className="input-text tabular"
                          required
                          aria-invalid={!!err}
                          aria-describedby={err ? errorId : undefined}
                        />
                        <span className="unit-label">{field.unit}</span>
                      </div>
                      <span className="range-hint">
                        Allowed: {field.min}–{field.max} {field.unit}
                      </span>
                      {err && (
                        <span id={errorId} className="field-error" role="alert">
                          {err}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className="form-submit-row">
        <button
          type="submit"
          className="btn-submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Recording telemetry...' : 'Submit Flight Telemetry'}
        </button>
      </div>
    </form>
  );
};
