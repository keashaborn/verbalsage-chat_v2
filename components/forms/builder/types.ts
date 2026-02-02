export type TemplateListItem = {
  template_id: string;
  name: string;
  status: string;
  created_at: string;
  latest_version_id?: string | null;
  latest_version?: number | null;
  latest_version_created_at?: string | null;
};

export type FormVersion = {
  version_id: string;
  template_id: string;
  version: number;
  json_schema: any;
  ui_schema: any;
  metadata: any;
  created_at: string;
};

export const DEFAULT_SCHEMA = `{
  "title": "Workout Session",
  "type": "object",
  "required": ["sessionDate", "exercises"],
  "properties": {
    "sessionDate": { "type": "string", "format": "date" },
    "sessionType": { "type": "string", "enum": ["Strength", "Conditioning", "Mobility", "Other"] },
    "exercises": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["name", "sets"],
        "properties": {
          "name": { "type": "string" },
          "sets": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "object",
              "required": ["reps"],
              "properties": {
                "weight": { "type": "number", "minimum": 0 },
                "reps": { "type": "integer", "minimum": 1 },
                "rpe": { "type": "number", "minimum": 1, "maximum": 10 },
                "notes": { "type": "string", "maxLength": 200 }
              }
            }
          }
        }
      }
    },
    "adherence": { "type": "string", "enum": ["Completed", "Partial", "Skipped"] },
    "notes": { "type": "string" }
  }
}`;
