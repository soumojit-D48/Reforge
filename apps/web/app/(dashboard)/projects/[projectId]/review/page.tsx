'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { Button } from '../../../../../components/ui/button';
import {
  useReviewDetail,
  useReviewQueue,
  useSubmitReview,
} from '../../../../../hooks/use-review';
import type { AnnotationVerdict } from '../../../../../lib/api-client';

const VERDICTS: Array<{ value: AnnotationVerdict; label: string }> = [
  { value: 'correct', label: 'Correct' },
  { value: 'incorrect', label: 'Incorrect' },
  { value: 'unsafe', label: 'Unsafe' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'wrong_category', label: 'Wrong category' },
];

function JsonValue({ value }: { value: unknown }): React.JSX.Element {
  return <pre className="json-block">{JSON.stringify(value, null, 2)}</pre>;
}

export default function ReviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): React.JSX.Element {
  const { projectId } = use(params);
  const queue = useReviewQueue(projectId);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(
    null,
  );
  const [verdict, setVerdict] = useState<AnnotationVerdict>('correct');
  const [note, setNote] = useState('');
  const detail = useReviewDetail(projectId, selectedAnnotationId);
  const submit = useSubmitReview(projectId, selectedAnnotationId);

  useEffect(() => {
    if (
      selectedAnnotationId === null &&
      queue.data !== undefined &&
      queue.data.length > 0
    ) {
      const firstReview = queue.data[0];

      if (firstReview !== undefined) {
        setSelectedAnnotationId(firstReview.id);
      }
    }
  }, [queue.data, selectedAnnotationId]);

  useEffect(() => {
    if (detail.data !== undefined) {
      setVerdict('correct');
      setNote('');
    }
  }, [detail.data]);

  if (queue.isPending) {
    return <p className="state-panel trace-state">Loading review queue...</p>;
  }

  if (queue.isError) {
    return (
      <p className="state-panel state-error trace-state" role="alert">
        Could not load review queue: {queue.error.message}
      </p>
    );
  }

  const selected = detail.data;

  return (
    <div className="dashboard-page review-page">
      <Link href={`/projects/${projectId}/runs`} className="back-link">
        Back to runs
      </Link>
      <header className="page-intro page-intro-wide">
        <div>
          <p className="page-kicker mono">HUMAN REVIEW / QUEUE</p>
          <h1>Review uncertain evaluations</h1>
          <p>Confirm whether the AI evaluator reached the right conclusion.</p>
        </div>
        <span className="mono">{queue.data.length} NEEDS REVIEW</span>
      </header>

      {queue.data.length === 0 ? (
        <section className="surface-panel empty-review-state">
          <h2>Queue is clear</h2>
          <p className="muted-copy">
            Low-confidence evaluations will appear here when they need a human
            decision.
          </p>
        </section>
      ) : (
        <section className="review-layout">
          <div className="surface-panel review-queue-list">
            <div className="panel-heading">
              <h2>Queue</h2>
              <span className="mono">OLDEST FIRST</span>
            </div>
            {queue.data.map((item) => (
              <button
                type="button"
                className={`review-queue-item ${
                  item.id === selectedAnnotationId ? 'is-selected' : ''
                }`}
                key={item.id}
                onClick={() => setSelectedAnnotationId(item.id)}
              >
                <span>
                  <strong>{item.evaluatorType}</strong>
                  <small>
                    {item.confidence === null
                      ? 'No confidence'
                      : `${Math.round(item.confidence * 100)}% confidence`}
                  </small>
                </span>
                <b>
                  {item.score === null
                    ? '—'
                    : `${Math.round(item.score * 100)}%`}
                </b>
              </button>
            ))}
          </div>

          <div className="review-detail-column">
            {detail.isPending ? (
              <p className="state-panel">Loading review detail...</p>
            ) : detail.isError ? (
              <p className="state-panel state-error" role="alert">
                Could not load review detail: {detail.error.message}
              </p>
            ) : selected === undefined ? (
              <p className="state-panel">Select a review.</p>
            ) : (
              <>
                <section className="surface-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Evaluation decision</h2>
                      <p className="muted-copy">
                        {selected.evaluatorVersion ?? selected.evaluatorType}
                      </p>
                    </div>
                    <strong className="review-score">
                      {selected.score === null
                        ? '—'
                        : `${Math.round(selected.score * 100)}%`}
                    </strong>
                  </div>
                  <div className="review-metrics">
                    <span>
                      Confidence:{' '}
                      {selected.confidence === null
                        ? '—'
                        : `${Math.round(selected.confidence * 100)}%`}
                    </span>
                    <span>
                      Rubric: {selected.rubricVersion ?? 'not versioned'}
                    </span>
                  </div>
                  <p className="review-reason">
                    {selected.reason ?? 'The evaluator did not provide a reason.'}
                  </p>
                  <div className="review-category-list">
                    <span className="mono">SUGGESTED CATEGORIES</span>
                    {selected.suggestedCategories.length === 0 ? (
                      <p className="muted-copy">No category was suggested.</p>
                    ) : (
                      selected.suggestedCategories.map((category) => (
                        <span className="tag-card tag-ai" key={category.category}>
                          {category.category}
                        </span>
                      ))
                    )}
                  </div>
                </section>

                <section className="review-context-grid">
                  <div className="surface-panel">
                    <h2>Input</h2>
                    <JsonValue value={selected.input} />
                  </div>
                  <div className="surface-panel">
                    <h2>Output</h2>
                    <JsonValue value={selected.output} />
                  </div>
                </section>

                <section className="surface-panel">
                  <div className="panel-heading">
                    <h2>Execution context</h2>
                    <span className="mono">{selected.spans.length} SPANS</span>
                  </div>
                  <div className="review-span-list">
                    {selected.spans.map((span) => (
                      <div className="review-span" key={span.id}>
                        <div>
                          <strong>{span.name}</strong>
                          <span className="mono">{span.type}</span>
                        </div>
                        <JsonValue
                          value={span.error ?? span.output ?? span.result}
                        />
                      </div>
                    ))}
                  </div>
                </section>

                <form
                  className="surface-panel review-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submit.mutate({ verdict, note });
                  }}
                >
                  <h2>Submit review</h2>
                  <label className="form-field">
                    Verdict
                    <select
                      className="app-select"
                      value={verdict}
                      onChange={(event) =>
                        setVerdict(event.target.value as AnnotationVerdict)
                      }
                    >
                      {VERDICTS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    Note
                    <textarea
                      className="app-input"
                      rows={4}
                      maxLength={2000}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Explain the review decision."
                    />
                  </label>
                  {submit.isError ? (
                    <p className="form-error" role="alert">
                      Could not submit review: {submit.error.message}
                    </p>
                  ) : null}
                  {submit.isSuccess ? (
                    <p className="form-success">Review submitted.</p>
                  ) : null}
                  <Button
                    type="submit"
                    className="signal-button"
                    disabled={submit.isPending}
                  >
                    {submit.isPending ? 'Submitting...' : 'Submit verdict'}
                  </Button>
                </form>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
