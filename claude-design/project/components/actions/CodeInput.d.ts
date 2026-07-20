export interface CodeInputProps {
  /** 桁数 (既定 6) */
  length?: number;
  value: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
  style?: React.CSSProperties;
}
export declare function CodeInput(props: CodeInputProps): JSX.Element;
