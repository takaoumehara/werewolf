export interface PrivacyCoverProps {
  /** 明示制御 (省略時は長押し中のみ開く) */
  covered?: boolean;
  onCoveredChange?: (covered: boolean) => void;
  holdLabel?: string;
  message?: string;
  children?: React.ReactNode;
  minHeight?: number | string;
  style?: React.CSSProperties;
}
export declare function PrivacyCover(props: PrivacyCoverProps): JSX.Element;
