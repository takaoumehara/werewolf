export interface PlayerRowProps {
  name: React.ReactNode;
  /** 自分の行 (「あなた」タグ) */
  me?: boolean;
  alive?: boolean;
  connection?: "online" | "offline" | "reconnecting";
  /** true=記録済 / false=入力待ち / undefined=非表示 */
  ready?: boolean;
  right?: React.ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  style?: React.CSSProperties;
}
export declare function PlayerRow(props: PlayerRowProps): JSX.Element;
