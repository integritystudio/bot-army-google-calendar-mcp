import { ToolRegistry } from './build/tools/registry.js';

const tools = ToolRegistry.getToolsWithSchemas();
console.log('Total tools:', tools.length);

console.log('\nTools with time parameters:');
const timeTools = [];
tools.forEach(tool => {
  const schemaStr = JSON.stringify(tool.inputSchema);
  if (schemaStr.includes('timeMin') || schemaStr.includes('timeMax') ||
      schemaStr.includes('"start"') || schemaStr.includes('"end"')) {
    console.log('  -', tool.name);
    timeTools.push(tool.name);
  }
});

console.log('\nAll tool names:');
tools.forEach(t => console.log('  -', t.name));

console.log('\nSample tool schema (first tool):');
if (tools.length > 0) {
  console.log(JSON.stringify(tools[0].inputSchema, null, 2).substring(0, 500));
}
