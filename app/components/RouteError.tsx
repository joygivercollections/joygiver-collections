interface RouteErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function RouteError({
  title = "Something went wrong",
  message = "We couldn't load this collection just now.",
  onRetry,
}: RouteErrorProps) {
  return (
    <section className="route-error" aria-live="polite">
      <span aria-hidden="true" className="route-error__mark">J</span>
      <h2>{title}</h2>
      <p>{message}</p>
      {onRetry ? (
        <button className="button button--dark" type="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </section>
  );
}
