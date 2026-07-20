export interface RecorderMessageProps {
  /** 記録者の文。敬体・短文。例「対象を 1 人選んでください。」 */
  text: React.ReactNode;
  /** 補足 (英訳など) */
  sub?: React.ReactNode;
  tone?: "neutral" | "urgent";
  compact?: boolean;
  style?: React.CSSProperties;
}
export declare function RecorderMessage(props: RecorderMessageProps): JSX.Element;
