export interface WaitingCountProps {
  /** 入力済み人数 */
  done: number;
  total: number;
  /** 既定文言の差し替え */
  label?: string;
  style?: React.CSSProperties;
}
export declare function WaitingCount(props: WaitingCountProps): JSX.Element;
