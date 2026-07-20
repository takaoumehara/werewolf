export interface CountdownTimerProps {
  /** 残り秒数 (親が 1s ごとに更新) */
  seconds: number;
  /** 全体秒数 — 指定すると残量バー表示 */
  total?: number;
  /** warning 色へ切替える残秒 (既定 30) */
  warnAt?: number;
  /** danger 色へ切替える残秒 (既定 10) */
  dangerAt?: number;
  size?: "md" | "lg";
  label?: string;
  style?: React.CSSProperties;
}
export declare function CountdownTimer(props: CountdownTimerProps): JSX.Element;
