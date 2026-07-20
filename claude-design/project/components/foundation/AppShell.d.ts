export interface AppShellProps {
  /** ゲームフェーズ — surface/ink/accent のモードを切替える */
  phase?: "day" | "night" | "dawn" | "verdict" | "finished";
  /** 左右 page-pad と safe-area padding を付けるか */
  pad?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function AppShell(props: AppShellProps): JSX.Element;
