export interface FullScreenRevealProps {
  open: boolean;
  /** 背景イラスト (assets/backgrounds/) */
  image?: string;
  /** 英字 kicker (Cinzel, Title Case) 例 "The Verdict" */
  kicker?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  continueLabel?: string;
  onContinue?: () => void;
  style?: React.CSSProperties;
}
export declare function FullScreenReveal(props: FullScreenRevealProps): JSX.Element;
