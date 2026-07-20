/** @startingPoint section="Game" subtitle="役職カード — 正本仕様 (360×640, 縦書きタイトル)" viewport="700x480" */
export interface RoleCardProps {
  /** 合成済みカード画像 (背景+人物が1枚のとき) */
  image?: string;
  /** 背景レイヤー backgrounds-72/{role_id}_bg.png */
  background?: string;
  /** 透過人物レイヤー 00_transparent-illustrations-72-a-refined/{role_id}_ver_a.png */
  character?: string;
  /** 日本語役職名 — 左上縦書き LINE Seed JP Bold 38px 字間6px (360幅基準で自動スケール) */
  roleName: React.ReactNode;
  /** 役職名の読み (ルビ) */
  ruby?: string;
  /** 英語役職名 — 右上 Cinzel Decorative Black。長さで 22/26/32px 自動 */
  roleNameEn?: string;
  faction?: "citizen" | "werewolf" | "third";
  /** 役職固有色 (--role-accent)。省略時は faction 色 */
  accent?: string;
  /** 下部バーの能力説明。省略時はバーなし (card_viewer と同じ全面アート) */
  summary?: React.ReactNode;
  width?: number;
  /** 下部バー内の陣営表示 */
  showFaction?: boolean;
  /** タイトルオーバーレイの表示 */
  showTitles?: boolean;
  style?: React.CSSProperties;
}
export declare function RoleCard(props: RoleCardProps): JSX.Element;
