export interface ReconnectOverlayProps {
  state?: "reconnecting" | "failed";
  /** 再試行回数 — 終わりの見えない演出を避ける */
  attempt?: number;
  onRetry?: () => void;
  style?: React.CSSProperties;
}
export declare function ReconnectOverlay(props: ReconnectOverlayProps): JSX.Element;
