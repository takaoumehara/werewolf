export interface SegmentedControlOption { value: string; label: React.ReactNode; }
export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange?: (value: string) => void;
  /** 横幅いっぱいに等分 */
  full?: boolean;
  style?: React.CSSProperties;
}
export declare function SegmentedControl(props: SegmentedControlProps): JSX.Element;
