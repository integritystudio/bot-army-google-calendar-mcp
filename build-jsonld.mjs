/**
 * Emits the mailbox's schema.org modeling as one flattened JSON-LD @graph.
 *
 * The modeling in `lib/vocabularies.mjs` and the `schema` blocks of `ORG_TAGS` is
 * otherwise source-only: constructed in memory on every run and discarded. This turns it
 * into an artifact that can be diffed, grepped and validated against schema.org tooling.
 *
 * Two rules keep the output honest:
 *
 * - **Nothing is invented.** A node with no `@id` stays an unidentified (blank) node
 *   rather than receiving a minted URL, matching the rule that governs the source.
 * - **Annotations are named; entities are left alone.** A `schema` block carrying only
 *   properties (`{ '@type': 'LodgingBusiness', keywords: [...] }`) describes the orgs
 *   tagged under it, so it is emitted once per org with that org's name and queries.
 *   A block that is already a complete entity — it has its own `@id` or `name`, like
 *   ORG_BZDC — is emitted as itself, with no Gmail metadata grafted on and no merging,
 *   which would otherwise collapse two organizations into one node.
 *
 * Usage:
 *   node build-jsonld.mjs            # write docs/mailbox.jsonld
 *   node build-jsonld.mjs --check    # exit 1 if the committed file is stale
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { VOCABULARIES } from './lib/vocabularies.mjs';
import { ORG_TAGS } from './config/org-tags.mjs';

const OUTPUT_PATH = 'docs/mailbox.jsonld';
const SCHEMA_CONTEXT = 'https://schema.org';
const DEFAULT_ORG_TYPE = 'Organization';
const GMAIL_LABEL_PROPERTY = 'gmail-label';
const GMAIL_QUERY_PROPERTY = 'gmail-query';
const JSON_INDENT = 2;

const isNode = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** A schema block that names or identifies itself is an entity; anything else annotates. */
const isEntity = (schema) => Boolean(schema?.['@id'] || schema?.name);

/**
 * Gmail metadata as schema.org identifiers, so the graph carries the mailbox's own keys
 * without adding properties outside the schema.org vocabulary.
 */
const identifiersFor = (labelName, query) => [
  { '@type': 'PropertyValue', propertyID: GMAIL_LABEL_PROPERTY, value: labelName },
  ...(query ? [{ '@type': 'PropertyValue', propertyID: GMAIL_QUERY_PROPERTY, value: query }] : []),
];

/**
 * Flattens a node tree into `graph`, replacing every `@id`-bearing node with a reference
 * so a term set shared by fourteen terms is serialized once. Nodes without an `@id` stay
 * inline. Repeat visits merge, letting the fullest description of a node win.
 */
function flatten(value, graph) {
  if (Array.isArray(value)) return value.map((item) => flatten(item, graph));
  if (!isNode(value)) return value;

  const flattened = Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, flatten(nested, graph)]),
  );

  const id = flattened['@id'];
  if (!id) return flattened;
  graph.set(id, { ...(graph.get(id) ?? {}), ...flattened });
  return { '@id': id };
}

/** Flattens a top-level node, keeping unidentified ones in the graph as anonymous nodes. */
function addNode(value, graph, anonymous) {
  const result = flatten(value, graph);
  if (!result['@id']) anonymous.push(result);
}

export function buildGraph() {
  const graph = new Map();
  const anonymous = [];

  for (const { termSet, terms } of VOCABULARIES) {
    addNode(termSet, graph, anonymous);
    for (const term of terms) addNode(term, graph, anonymous);
  }

  for (const tag of ORG_TAGS) {
    for (const org of tag.entries) {
      const schema = org.schema ?? (tag.schema && !isEntity(tag.schema) ? tag.schema : null);
      if (!schema) continue;
      if (isEntity(schema)) {
        addNode(schema, graph, anonymous);
        continue;
      }
      const { '@type': type, ...properties } = schema;
      addNode({
        '@type': type ?? DEFAULT_ORG_TYPE,
        name: org.name,
        ...properties,
        identifier: identifiersFor(tag.labelName, org.query),
      }, graph, anonymous);
    }
    // A group-level entity (ORG_BZDC) describes the group itself, not any single org.
    if (isEntity(tag.schema)) addNode(tag.schema, graph, anonymous);
  }

  const sortKey = (node) => `${[node['@type']].flat().join('+')}|${node['@id'] ?? node.name ?? ''}`;
  const nodes = [...graph.values(), ...anonymous]
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  // No build timestamp: it would make every rebuild a diff, and the file is committed.
  return { '@context': SCHEMA_CONTEXT, '@graph': nodes };
}

export const serialize = (document) => `${JSON.stringify(document, null, JSON_INDENT)}\n`;

function main() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        check: { type: 'boolean', default: false },
      },
    }));
  } catch (error) {
    console.error(error.message);
    console.error('Usage: node build-jsonld.mjs [--check]');
    process.exit(1);
  }
  const document = buildGraph();
  const serialized = serialize(document);
  const nodes = document['@graph'];
  const summary = `${nodes.length} nodes (${nodes.filter((n) => n['@id']).length} identified, `
    + `${nodes.filter((n) => !n['@id']).length} anonymous)`;

  if (values.check) {
    const committed = readFileSync(OUTPUT_PATH, 'utf8');
    if (committed !== serialized) {
      console.error(`${OUTPUT_PATH} is stale — run: node build-jsonld.mjs`);
      process.exit(1);
    }
    console.log(`${OUTPUT_PATH} up to date — ${summary}`);
    return;
  }

  writeFileSync(OUTPUT_PATH, serialized);
  console.log(`Wrote ${OUTPUT_PATH} — ${summary}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
