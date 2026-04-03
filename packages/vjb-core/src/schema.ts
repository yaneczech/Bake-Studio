import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import type { ErrorObject } from "ajv";
import type { VjbManifest } from "./manifest";
import { createManifestHardRuleReport } from "./hard-rules";
import manifestSchema from "./schema/manifest.schema.json";

export type SchemaValidationReport = {
  valid: boolean;
  errors: string[];
};

export type ManifestValidationReport = {
  valid: boolean;
  schemaErrors: string[];
  hardRuleErrors: string[];
  errors: string[];
};

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
});

addFormats(ajv);

const validateManifestSchemaFn = ajv.compile<VjbManifest>(manifestSchema);

export function validateManifestSchema(input: unknown): SchemaValidationReport {
  const valid = validateManifestSchemaFn(input);

  return {
    valid: Boolean(valid),
    errors: valid ? [] : formatAjvErrors(validateManifestSchemaFn.errors),
  };
}

export function validateManifest(input: unknown): ManifestValidationReport {
  const schemaReport = validateManifestSchema(input);

  if (!schemaReport.valid) {
    return {
      valid: false,
      schemaErrors: schemaReport.errors,
      hardRuleErrors: [],
      errors: schemaReport.errors,
    };
  }

  const hardRuleReport = createManifestHardRuleReport(input as VjbManifest);
  const errors = [...schemaReport.errors, ...hardRuleReport.errors];

  return {
    valid: errors.length === 0,
    schemaErrors: schemaReport.errors,
    hardRuleErrors: hardRuleReport.errors,
    errors,
  };
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors || errors.length === 0) {
    return [];
  }

  return errors.map((error) => {
    const location = error.instancePath || "/";

    switch (error.keyword) {
      case "required":
        return `${location} is missing required property ${String(error.params.missingProperty)}`;
      case "additionalProperties":
        return `${location} has unexpected property ${String(error.params.additionalProperty)}`;
      default:
        return `${location} ${error.message ?? "is invalid"}`;
    }
  });
}
