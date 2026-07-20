export interface PhaseBackdropProps {
  /** assets/backgrounds/ のイラスト URL。省略時は scrim のみ */
  image?: string;
  /** 被せる scrim (既定 --overlay-scrim)。本文コントラスト維持が目的 */
  scrim?: string;
  /** true で下方向グラデーション (--overlay-reveal) を使う */
  gradient?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function PhaseBackdrop(props: PhaseBackdropProps): JSX.Element;
