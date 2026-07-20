import { PlayerRowProps } from "./PlayerRow";
export interface PlayerListItem extends PlayerRowProps { id?: string | number; disabled?: boolean; }
export interface PlayerListProps {
  players: PlayerListItem[];
  /** 選択可能リストとして使う場合 */
  selectedId?: string | number;
  onSelect?: (id: string | number) => void;
  style?: React.CSSProperties;
}
export declare function PlayerList(props: PlayerListProps): JSX.Element;
