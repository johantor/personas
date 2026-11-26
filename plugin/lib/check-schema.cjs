'use strict';
// personas-check <findings|personas> <file>: validates a file against schema/<name>.schema.json,
// so neither the reporter's JSON nor a hand-edited personas.json is trusted unchecked (#5, #6).
// It reads the schema itself and supports only the keywords our schemas use; any other keyword
// is an error, so a schema change that needs more fails loudly (CLAUDE.md, Map).
const fs = require('node:fs');
const path = require('node:path');

const KNOWN = new Set(['$schema', '$id', '$defs', '$ref', 'title', 'description', 'type', 'items', 'additionalProperties', 'required', 'properties', 'enum', 'pattern', 'minItems', 'minimum']);

const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : Number.isInteger(v) ? 'integer' : typeof v);
const matchesType = (v, type) => typeOf(v) === type || (type === 'number' && typeOf(v) === 'integer');

function check(value, schema, root, at, errors) {
  for (const key of Object.keys(schema)) if (!KNOWN.has(key)) throw new Error(`schema keyword ${key} at ${at} is not supported`);
  if (schema.$ref) {
    const name = schema.$ref.match(/^#\/\$defs\/([\w-]+)$/)?.[1];
    if (!name || !Object.hasOwn(root.$defs || {}, name)) throw new Error(`schema $ref ${schema.$ref} at ${at} is not a local $defs entry`);
    return check(value, root.$defs[name], root, at, errors);
  }
  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(`${at}: expected ${schema.type}, got ${typeOf(value)}`);
    return errors;
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${at}: ${JSON.stringify(value)} is not one of ${schema.enum.join(', ')}`);
  if (schema.pattern && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) errors.push(`${at}: ${JSON.stringify(value)} does not match ${schema.pattern}`);
  if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum) errors.push(`${at}: ${value} is below ${schema.minimum}`);
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) errors.push(`${at}: needs at least ${schema.minItems} items`);
    if (schema.items) value.forEach((v, i) => check(v, schema.items, root, `${at}[${i}]`, errors));
  }
  if (typeOf(value) === 'object') {
    for (const key of schema.required || []) if (!(key in value)) errors.push(`${at}: missing ${key}`);
    for (const [key, v] of Object.entries(value)) {
      // Own properties only: an inherited name such as constructor is an unknown field.
      if (schema.properties && Object.hasOwn(schema.properties, key)) check(v, schema.properties[key], root, `${at}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${at}: unknown field ${key}`);
    }
  }
  return errors;
}

function main(name, file) {
  if (!['findings', 'personas'].includes(name) || !file) throw new Error('usage: personas-check <findings|personas> <file>');
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schema', `${name}.schema.json`), 'utf8'));
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${file} is not valid JSON: ${err.message}`);
  }
  const errors = check(data, schema, schema, name, []);
  if (errors.length) throw new Error(`${file} does not match the ${name} schema:\n${errors.join('\n')}`);
  process.stdout.write(`${file} matches the ${name} schema\n`);
}

try {
  main(process.argv[2], process.argv[3]);
} catch (err) {
  process.stderr.write(`personas-check: ${err.message}\n`);
  process.exit(1);
}
