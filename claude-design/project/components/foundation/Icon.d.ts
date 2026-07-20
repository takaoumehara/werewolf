export interface IconProps {
  /** Lucide icon name, PascalCase (e.g. "Moon", "WifiOff") */
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}
export declare function Icon(props: IconProps): JSX.Element;
