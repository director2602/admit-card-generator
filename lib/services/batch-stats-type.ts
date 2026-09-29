export interface BatchStats {
  total: number;
  valid: number;
  invalid: number;
  duplicate: number;
  flagged: number;
  generated: number;
  failed: number;
  pending: number;
  inProgress: number;
}
