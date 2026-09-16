export type ReplayChangedField =
  | 'prompt'
  | 'model'
  | 'tool_arguments'
  | 'retrieval_config'
  | 'temperature';

export type FieldResolution = 'changed' | 'reused' | 'mocked' | 'fresh';

export type FieldResolutionMap = Record<string, FieldResolution>;
