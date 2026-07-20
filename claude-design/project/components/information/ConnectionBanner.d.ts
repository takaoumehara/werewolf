export interface ConnectionBannerProps {
  state?: "offline" | "reconnecting" | "restored";
  /** true = SyncIndicator (インライン小型表示) */
  compact?: boolean;
  /** 既定の説明文を差し替え */
  detail?: string;
  style?: React.CSSProperties;
}
export declare function ConnectionBanner(props: ConnectionBannerProps): JSX.Element;
