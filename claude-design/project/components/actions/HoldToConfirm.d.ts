export interface HoldToConfirmProps {
  label: string;
  /** 補助文 (既定「長押しで確定」) */
  hint?: string;
  /** 長押し時間 ms (既定 900)。reduced-motion 環境では即時確定 */
  duration?: number;
  variant?: "danger" | "primary";
  disabled?: boolean;
  onConfirm?: () => void;
  full?: boolean;
  style?: React.CSSProperties;
}
export declare function HoldToConfirm(props: HoldToConfirmProps): JSX.Element;
