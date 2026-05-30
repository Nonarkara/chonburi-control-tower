import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          color: "var(--text)",
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          padding: 24,
        }}>
          <div style={{ maxWidth: 520, textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>⚠</div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 8 }}>
              Dashboard encountered an error
            </h1>
            <p style={{ color: "var(--text-2)", marginBottom: 20, lineHeight: 1.5 }}>
              Something went wrong while rendering the map or data panels.
              Try reloading the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 18px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: "var(--bg-2)",
                color: "var(--text)",
                cursor: "pointer",
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              Reload page
            </button>
            {this.state.error && (
              <pre style={{
                marginTop: 20,
                padding: 12,
                background: "var(--bg-2)",
                borderRadius: 6,
                fontSize: "0.75rem",
                color: "var(--text-2)",
                overflow: "auto",
                textAlign: "left",
              }}>
                {this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
