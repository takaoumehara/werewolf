export interface InlineNoticeAction { label: string; onClick?: () => void; variant?: "primary" | "secondary" | "quiet" | "danger"; }
export interface InlineNoticeProps {
  tone?: "info" | "warning" | "danger" | "success";
  title?: React.ReactNode;
  /** 「何が起きたか + 次にできること」 */
  body?: React.ReactNode;
  /** 復帰操作 — これがある形が ErrorRecoveryPanel */
  actions?: InlineNoticeAction[];
  style?: React.CSSProperties;
}
export declare function InlineNotice(props: InlineNoticeProps): JSX.Element;
