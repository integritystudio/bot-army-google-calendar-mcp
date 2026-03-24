import { ToolSchemas } from './src/tools/registry.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import z from 'zod';

const updateEventSchema = ToolSchemas['update-event'];

// Test 1: Direct conversion
console.log('Test 1: Direct zodToJsonSchema');
const result1 = zodToJsonSchema(updateEventSchema as any);
console.log('Type:', (result1 as any).type);
console.log('Keys:', Object.keys(result1));

// Test 2: With options
console.log('\nTest 2: zodToJsonSchema with options');
const result2 = zodToJsonSchema(updateEventSchema as any, {
  target: 'jsonSchema7',
  definitions: {}
});
console.log('Type:', (result2 as any).type);
console.log('Keys:', Object.keys(result2));

// Test 3: Simple z.object test
console.log('\nTest 3: Simple z.object');
const simpleSchema = z.object({
  name: z.string(),
  age: z.number()
});
const result3 = zodToJsonSchema(simpleSchema);
console.log('Type:', (result3 as any).type);
console.log('Full output:', JSON.stringify(result3, null, 2));

// Test 4: Unwrap and convert
console.log('\nTest 4: Unwrap refine and convert');
let unwrappedSchema = updateEventSchema as any;
while (unwrappedSchema._def && unwrappedSchema._def.typeName === 'ZodEffects') {
  unwrappedSchema = unwrappedSchema._def.schema;
}
const result4 = zodToJsonSchema(unwrappedSchema);
console.log('Type:', (result4 as any).type);
console.log('Keys:', Object.keys(result4));
console.log('Properties count:', Object.keys((result4 as any).properties || {}).length);
