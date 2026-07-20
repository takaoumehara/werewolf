export interface QRJoinPanelProps {
  /** 参加 URL (QR 化される) */
  url: string;
  /** 併記する 6 桁コード */
  code?: string | number;
  hint?: string;
  style?: React.CSSProperties;
}
export declare function QRJoinPanel(props: QRJoinPanelProps): JSX.Element;
