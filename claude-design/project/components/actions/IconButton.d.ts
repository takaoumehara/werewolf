export interface IconButtonProps {
  /** Lucide icon name (PascalCase) */
  name: string;
  /** aria-label — 必須。アイコン単独使用の唯一の許可条件 */
  label: string;
  variant?: "quiet" | "secondary";
  size?: number;
  disabled?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
