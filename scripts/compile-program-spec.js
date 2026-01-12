#!/usr/bin/env node
"use strict";

const fs = require("fs");

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function readJson(p) {
  const raw = fs.readFileSync(p, "utf8");
  try { return JSON.parse(raw); }
  catch (e) { die(`invalid JSON in ${p}: ${e.message}`); }
}

function compile(spec, ownerUserIdOverride) {
  const owner_user_id = ownerUserIdOverride || spec.owner_user_id;
  if (!owner_user_id) die(`missing owner_user_id (set env OWNER=... or add spec.owner_user_id)`);

  const name = spec.name || spec.title;
  if (!name) die(`missing spec.name`);

  const fields = Array.isArray(spec.fields) ? spec.fields : [];
  if (!fields.length) die(`missing spec.fields[]`);

  const properties = {};
  const required = [];

  const ui_schema = {};
  const order = [];

  for (const f of fields) {
    if (!f || typeof f !== "object") die(`field must be object`);
    const key = String(f.key || "").trim();
    if (!key) die(`field missing key`);

    order.push(key);

    const title = f.title ? String(f.title) : undefined;
    const description = f.description ? String(f.description) : undefined;

    // enum -> string enum
    if (Array.isArray(f.enum) && f.enum.length) {
      properties[key] = {
        type: "string",
        enum: f.enum.map(String),
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
      };
    } else {
      const t = String(f.type || "string");
      if (!["string", "integer", "number", "boolean"].includes(t)) {
        die(`field ${key} has unsupported type: ${t}`);
      }

      const prop = { type: t };
      if (title) prop.title = title;
      if (description) prop.description = description;

      if (t === "string" && f.format) prop.format = String(f.format);
      if ((t === "integer" || t === "number") && typeof f.minimum === "number") prop.minimum = f.minimum;
      if ((t === "integer" || t === "number") && typeof f.maximum === "number") prop.maximum = f.maximum;

      properties[key] = prop;
    }

    if (f.widget === "textarea") {
      ui_schema[key] = { "ui:widget": "textarea" };
    }

    if (f.required === true) required.push(key);
  }

  const json_schema = {
    title: name,
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
  };

  // stable field order
  ui_schema["ui:order"] = order;

  const metadata = {
    program_spec_v0: spec,
    measurement: spec.measurement || null,
    graph_spec_v0: spec.graph_spec_v0 || null,
  };

  return { owner_user_id, name, json_schema, ui_schema, metadata };
}

const specPath = process.argv[2];
if (!specPath) die(`usage: node scripts/compile-program-spec.js <spec.json>`);

const spec = readJson(specPath);
const OWNER = process.env.OWNER && process.env.OWNER.trim() ? process.env.OWNER.trim() : null;

const out = compile(spec, OWNER);
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
