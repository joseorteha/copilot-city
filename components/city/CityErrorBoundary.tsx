"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  failed: boolean;
  message: string;
}

/**
 * Suspense covers loading, not throwing: without this, one bad geometry or a lost WebGL
 * context takes the whole page down, and the page is the application. The panels live in
 * the DOM outside the canvas, so they survive.
 */
export class CityErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, message: error instanceof Error ? error.message : "Error desconocido" };
  }

  componentDidCatch(error: unknown) {
    console.error("City scene failed", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="scene-fallback" role="alert">
        <b>No pudimos dibujar la ciudad</b>
        <p>
          El motor 3D se detuvo. Suele ocurrir cuando el navegador pierde el contexto gráfico o no tiene
          aceleración disponible.
        </p>
        <code>{this.state.message}</code>
        <button onClick={() => this.setState({ failed: false, message: "" })}>Reintentar</button>
      </div>
    );
  }
}
