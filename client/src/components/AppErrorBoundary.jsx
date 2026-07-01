import React, { Component } from "react";

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-pearl px-4 py-10 text-ink dark:bg-neutral-950 dark:text-neutral-100">
          <div className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-white p-6 shadow-soft dark:border-red-900 dark:bg-neutral-900">
            <p className="text-sm font-bold uppercase tracking-wide text-red-600">App error</p>
            <h1 className="mt-2 text-2xl font-black">VASTRA could not render.</h1>
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
              Clear this site&apos;s local storage and refresh. The error details are shown below for debugging.
            </p>
            <pre className="mt-4 overflow-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-950">
              {this.state.error.message}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
