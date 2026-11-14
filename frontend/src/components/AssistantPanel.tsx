import React, { useState } from 'react';
import type { AssistantAnswer, DomainStatus } from '../types.js';
import { getSuggestedQuestions } from '../utils/assistant.js';

interface AssistantPanelProps {
  astronautId: string;
  flaggedDomains?: DomainStatus[];
  onAsk: (question: string) => Promise<AssistantAnswer>;
}

export const AssistantPanel: React.FC<AssistantPanelProps> = ({
  astronautId,
  flaggedDomains = [],
  onAsk,
}) => {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);

  const suggestedQuestions = getSuggestedQuestions(flaggedDomains);

  const handleSubmit = async (qText: string) => {
    const trimmed = qText.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await onAsk(trimmed);
      setAnswer(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to communicate with assistant. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSubmit(question);
  };

  return (
    <section className="assistant-panel" aria-label="Flight Health Assistant">
      <div className="assistant-header">
        <div className="header-titles">
          <span className="section-label">ONBOARD INTELLIGENCE</span>
          <h2 className="assistant-title">VITALIS FLIGHT ASSISTANT</h2>
        </div>
        <span className="astronaut-badge tabular">{astronautId.toUpperCase()}</span>
      </div>

      {/* Suggested Questions */}
      <div className="suggested-questions-wrap">
        <span className="suggested-label">CONTEXTUAL PROMPTS</span>
        <div className="suggested-buttons">
          {suggestedQuestions.map((sq, i) => (
            <button
              key={i}
              type="button"
              className="btn-suggestion"
              onClick={() => {
                setQuestion(sq);
                void handleSubmit(sq);
              }}
              disabled={isLoading}
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Question Form */}
      <form onSubmit={handleFormSubmit} className="assistant-form" noValidate>
        <label htmlFor="assistant-question-input" className="field-label">
          ASK A HEALTH OR COUNTERMEASURE QUESTION (MAX 500 CHARACTERS)
        </label>
        <div className="textarea-container">
          <textarea
            id="assistant-question-input"
            className="assistant-textarea"
            rows={3}
            maxLength={500}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="e.g. Why is my resting heart rate elevated today?"
            disabled={isLoading}
            aria-describedby="char-count"
            required
          />
          <div className="textarea-footer">
            <span id="char-count" className="char-count tabular">
              {question.length}/500
            </span>
            <button
              type="submit"
              className="btn-ask"
              disabled={isLoading || !question.trim()}
            >
              {isLoading ? 'Querying...' : 'Ask Assistant'}
            </button>
          </div>
        </div>
      </form>

      {/* Loading State (Calm, no skeleton shimmer per DESIGN.md § Motion) */}
      {isLoading && (
        <div className="assistant-state loading-state" role="status">
          <span className="loading-symbol" aria-hidden="true">■</span>
          <p className="state-message">Consulting onboard knowledge base and telemetry...</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="assistant-state error-state" role="alert">
          <div className="error-header">
            <span className="error-symbol" aria-hidden="true">▲</span>
            <span className="error-title">COMMUNICATION ANOMALY</span>
          </div>
          <p className="state-message">{error}</p>
          <button
            type="button"
            className="btn-retry"
            onClick={() => void handleSubmit(question)}
          >
            Retry Request
          </button>
        </div>
      )}

      {/* Answer Display */}
      {answer && !isLoading && !error && (
        <article className="assistant-answer-card" aria-label="Assistant Guidance">
          {/* Status Badges Header */}
          <div className="answer-meta-header">
            {answer.escalate && (
              <span className="badge-escalate" role="alert">
                <span className="badge-symbol" aria-hidden="true">▲</span>
                <span className="badge-text">ESCALATE TO GROUND IMMEDIATELY</span>
              </span>
            )}

            {answer.fallback_used && (
              <span className="badge-fallback">
                <span className="badge-symbol" aria-hidden="true">◼</span>
                <span className="badge-text">Fallback guidance (deterministic)</span>
              </span>
            )}
          </div>

          {/* Summary (Rendered as escaped plain text, NEVER HTML) */}
          <div className="answer-section">
            <h3 className="section-label">CLINICAL SUMMARY</h3>
            <p className="answer-summary">{answer.summary}</p>
          </div>

          {/* Explanation (Rendered as escaped plain text) */}
          <div className="answer-section">
            <h3 className="section-label">TELEMETRY CORRELATION</h3>
            <p className="answer-explanation">{answer.explanation}</p>
          </div>

          {/* Numbered Steps */}
          {answer.steps && answer.steps.length > 0 && (
            <div className="answer-section">
              <h3 className="section-label">ACTION PROTOCOL (MAX 5 STEPS)</h3>
              <ol className="answer-steps-list">
                {answer.steps.map((step, idx) => (
                  <li key={idx} className="step-item">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Sources as Chips */}
          {answer.sources && answer.sources.length > 0 && (
            <div className="answer-section sources-section">
              <h3 className="section-label">RETRIEVED KNOWLEDGE SOURCES</h3>
              <div className="sources-chips-container">
                {answer.sources.map((src, i) => (
                  <span key={i} className="source-chip tabular">
                    {src}
                  </span>
                ))}
              </div>
            </div>
          )}
        </article>
      )}
    </section>
  );
};
