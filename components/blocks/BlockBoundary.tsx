"use client";

import { Component, type ReactNode } from "react";
import { BlockFallback } from "./BlockFallback";

type Props = { label: string; children: ReactNode };
type State = { error: Error | null };

/** One broken block never takes the lesson down. */
export class BlockBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.warn(`[class-os] block "${this.props.label}" crashed:`, error.message);
  }
  render() {
    if (this.state.error) {
      return <BlockFallback title={`This ${this.props.label} block hit an error`} detail={this.state.error.message} />;
    }
    return this.props.children;
  }
}
