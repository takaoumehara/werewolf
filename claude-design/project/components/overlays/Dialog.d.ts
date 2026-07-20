export interface DialogAction { label: string; onClick?: () => void; variant?: "primary" | "secondary" | "quiet" | "danger"; }
export interface DialogProps {
  open: boolean;
  title: React.ReactNode;
  body?: React.ReactNode;
  /** 縦積みボタン。最初が主操作 */
  actions?: DialogAction[];
  tone?: "neutral" | "danger";
  style?: React.CSSProperties;
}
export declare function Dialog(props: DialogProps): JSX.Element;
