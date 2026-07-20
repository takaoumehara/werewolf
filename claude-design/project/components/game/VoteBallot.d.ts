import { PlayerListItem } from "./PlayerList";
export interface VoteBallotProps {
  players: PlayerListItem[];
  value?: string | number;
  onChange?: (id: string | number) => void;
  /** 記録済 — 選択をロックし状態バッジを出す (二重送信防止) */
  submitted?: boolean;
  /** 例「締切まで変更できます」 */
  deadlineNote?: string;
  style?: React.CSSProperties;
}
export declare function VoteBallot(props: VoteBallotProps): JSX.Element;
