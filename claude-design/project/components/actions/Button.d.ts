/** @startingPoint section="Actions" subtitle="primary / secondary / quiet / danger" viewport="700x260" */
export interface ButtonProps {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  size?: "md" | "lg";
  /** 幅 100% (画面下の主操作) */
  full?: boolean;
  disabled?: boolean;
  /** 送信中: スピナー表示 + 操作不可。二重送信防止に必ず使う */
  loading?: boolean;
  /** 先頭アイコン (Icon 要素) */
  icon?: React.ReactNode;
  onClick?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Button(props: ButtonProps): JSX.Element;
