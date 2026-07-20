export interface ToastProps {
  open: boolean;
  text: React.ReactNode;
  status?: "success" | "warning" | "danger" | "info";
  /** コンテナ下端からの距離 px */
  bottom?: number;
  style?: React.CSSProperties;
}
export declare function Toast(props: ToastProps): JSX.Element;
