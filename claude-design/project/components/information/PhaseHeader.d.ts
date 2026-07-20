export interface PhaseHeaderProps {
  phase?: "day" | "night" | "dawn" | "verdict" | "finished";
  /** 経過日数 (「第 N 日」) */
  dayCount?: number;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** 右上スロット (CountdownTimer 等) */
  right?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function PhaseHeader(props: PhaseHeaderProps): JSX.Element;
