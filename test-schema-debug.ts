import { ToolRegistry, ToolSchemas } from './src/tools/registry.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

const tools = ToolRegistry.getToolsWithSchemas();
const updateEventTool = tools.find(t => t.name === 'update-event');

console.log('Update Event Tool:');
console.log(JSON.stringify(updateEventTool, null, 2));

// Check the schema type
if (updateEventTool) {
  console.log('\ninputSchema type:', (updateEventTool.inputSchema as any).type);
  console.log('inputSchema keys:', Object.keys(updateEventTool.inputSchema as any));
}

// Also check the original Zod schema
console.log('\nOriginal ToolSchemas keys:', Object.keys(ToolSchemas));
const updateEventSchema = ToolSchemas['update-event'];
console.log('Update event Zod schema:', updateEventSchema?.toString?.());

const jsonSchema = zodToJsonSchema(updateEventSchema as any);
console.log('\nDirect zodToJsonSchema output:');
console.log(JSON.stringify(jsonSchema, null, 2).substring(0, 500));
