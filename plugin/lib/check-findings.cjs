'use strict';
// check-findings <findings.json>: validates a findings file against schema/findings.schema.json,
// so the runner does not trust the reporter's JSON unchecked (#5, "Done when"). It reads the
// schema itself and supports only the keywords that schema uses; any other keyword is an error.
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = path.join(__dirname, '..', 'schema', 'findings.schema.json');
const KNOWN = new Set(['$schema', '$id', 'title', 'description', 'type', 'items', 'additionalProperties', 'required', 'properties', 'enum', 'pattern', 'minItems']);

const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);

function check(value, schema, at, errors) {
  for (const key of Object.keys(schema)) if (!KNOWN.has(key)) throw new Error(`schema keyword ${key} at ${at} is not supported`);
  if (schema.type && typeOf(value) !== schema.type) {
    errors.push(`${at}: expected ${schema.type}, got ${typeOf(value)}`);
    return errors;
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${at}: ${JSON.stringify(value)} is not one of ${schema.enum.join(', ')}`);
  if (schema.pattern && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) errors.push(`${at}: ${JSON.stringify(value)} does not match ${schema.pattern}`);
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) errors.push(`${at}: needs at least ${schema.minItems} items`);
    if (schema.items) value.forEach((v, i) => check(v, schema.items, `${at}[${i}]`, errors));
  }
  if (typeOf(value) === 'object') {
    for (const key of schema.required || []) if (!(key in value)) errors.push(`${at}: missing ${key}`);
    for (const [key, v] of Object.entries(value)) {
      // Own properties only: an inherited name such as constructor is an unknown field.
      if (schema.properties && Object.hasOwn(schema.properties, key)) check(v, schema.properties[key], `${at}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${at}: unknown field ${key}`);
    }
  }
  return errors;
}

function main(file) {
  if (!file) throw new Error('usage: node check-findings.cjs <findings.json>');
  const schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${file} is not valid JSON: ${err.message}`);
  }
  const errors = check(data, schema, 'findings', []);
  if (errors.length) throw new Error(`${file} does not match the schema:\n${errors.join('\n')}`);
  process.stdout.write(`${file}: ${data.length} findings match the schema\n`);
}

try {
  main(process.argv[2]);
} catch (err) {
  process.stderr.write(`check-findings: ${err.message}\n`);
  process.exit(1);
}
