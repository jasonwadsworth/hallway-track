import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  message?: string;
  inline?: boolean;
}

export function LoadingSpinner({ message = 'Loading...', inline = false }: LoadingSpinnerProps) {
  if (inline) {
    return (
      <div className="loading-spinner-inline">
        <div className="loading-spinner" />
        {message && <span className="loading-text">{message}</span>}
      </div>
    );
  }

  return (
    <div className="loading-spinner-container">
      <div className="loading-spinner" />
      {message && <span className="loading-text">{message}</span>}
    </div>
  );
}
