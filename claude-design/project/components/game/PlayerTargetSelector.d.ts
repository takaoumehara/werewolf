import { PlayerListItem } from "./PlayerList";
export interface PlayerTargetSelectorProps {
  players: PlayerListItem[];
  value?: string | number;
  onChange?: (id: string | number) => void;
  prompt?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function PlayerTargetSelector(props: PlayerTargetSelectorProps): JSX.Element;
