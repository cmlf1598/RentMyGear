"use client";

import { Component, type ReactNode } from "react";

interface SectionErrorBoundaryProps {
  /** Shown in the console as `[ErrorBoundary:<name>]`, like the route-level boundaries. */
  name: string;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Contains a failure to one section of a page (e.g. the hero carousel), so the rest of the page
 * keeps rendering instead of React unmounting the whole tree.
 */
export class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[ErrorBoundary:${this.props.name}]`, error);
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
