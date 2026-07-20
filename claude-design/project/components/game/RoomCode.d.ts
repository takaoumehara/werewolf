export interface RoomCodeProps {
  /** 6桁コード (例 "834107") */
  code: string | number;
  label?: string;
  size?: "md" | "lg";
  style?: React.CSSProperties;
}
export declare function RoomCode(props: RoomCodeProps): JSX.Element;
