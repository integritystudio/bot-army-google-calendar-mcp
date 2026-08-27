import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../../../tools/registry.js';

describe('Schema $ref Prevention Tests', () => {
  it('should not generate $ref references in JSON schemas, causes issues with Claude Desktop', () => {
    const tools = ToolRegistry.getToolsWithSchemas();
    
    // Convert each tool schema to JSON Schema and check for $ref
    for (const tool of tools) {
      const jsonSchema = JSON.stringify(tool.inputSchema);
      
      // Check for any $ref references
      const hasRef = jsonSchema.includes('"$ref"');
      
      if (hasRef) {
        console.error(`Tool "${tool.name}" contains $ref in schema:`, jsonSchema);
      }
      
      expect(hasRef).toBe(false);
    }
  });
});