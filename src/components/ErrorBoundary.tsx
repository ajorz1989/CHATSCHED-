import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { reportError } from "../lib/errorTracking";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundaryInner extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { source: "ErrorBoundary", componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-md mx-auto px-5 py-24 text-center">
          <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-billboard-red border-[3px] border-billboard-ink flex items-center justify-center text-2xl text-white" aria-hidden="true">!</div>
          <h1 className="text-2xl mb-2">Something went wrong</h1>
          <p className="text-billboard-inkSoft mb-8">This page hit a snag. Reloading usually fixes it — if it keeps happening, let us know.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm"
            >
              Reload page
            </button>
            <Link to="/" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-white">
              Go home
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Wraps the routed page content (not the whole app — Header/Footer/
 * BottomNav stay outside this, so a crash in one page doesn't take
 * navigation down with it). Keyed on the route so navigating to a
 * different, working page clears the error automatically instead of
 * leaving the fallback stuck until a full reload.
 */
export default function ErrorBoundary({ children }: Props) {
  const location = useLocation();
  return <ErrorBoundaryInner key={location.pathname}>{children}</ErrorBoundaryInner>;
}
