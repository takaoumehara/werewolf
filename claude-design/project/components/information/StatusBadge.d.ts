export interface StatusBadgeProps {
  status?: "success" | "warning" | "danger" | "info" | "offline" | "reconnecting" | "neutral";
  label: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function StatusBadge(props: StatusBadgeProps): JSX.Element;
