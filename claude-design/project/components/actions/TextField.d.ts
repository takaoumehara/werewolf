export interface TextFieldProps {
  label?: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** 補助文 (12px) */
  hint?: string;
  /** エラー文。「何が起きたか + 次にできること」で書く */
  error?: string;
  maxLength?: number;
  type?: string;
  style?: React.CSSProperties;
}
export declare function TextField(props: TextFieldProps): JSX.Element;
