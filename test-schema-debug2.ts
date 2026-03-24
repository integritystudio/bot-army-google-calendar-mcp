import { ToolSchemas } from './src/tools/registry.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

const updateEventSchema = ToolSchemas['update-event'];
console.log('Update event schema type:', typeof updateEventSchema);
console.log('Update event schema constructor:', updateEventSchema?.constructor?.name);
console.log('Update event schema _def:', (updateEventSchema as any)?._def);

// Try to convert it
try {
  const jsonSchema = zodToJsonSchema(updateEventSchema as any);
  console.log('\nJSON Schema output:');
  console.log(JSON.stringify(jsonSchema, null, 2));
} catch (error) {
  console.error('Error converting schema:', error);
}

// Try with shape extraction if it's a ZodObject
if ((updateEventSchema as any)?._def?.shape) {
  console.log('\nSchema has shape property, has', Object.keys((updateEventSchema as any)._def.shape).length, 'properties');
}
