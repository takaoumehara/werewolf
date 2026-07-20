export interface BottomSheetProps {
  open: boolean;
  title?: React.ReactNode;
  onClose?: () => void;
  children?: React.ReactNode;
  /** 例 "70%"。ルール表 (RulesDrawer) はこれを "85%" にしてスクロール */
  maxHeight?: string;
  style?: React.CSSProperties;
}
export declare function BottomSheet(props: BottomSheetProps): JSX.Element;
