import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry, ToolSchemas } from '../../../tools/registry.js';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Tool Registration Tests
 * 
 * These tests validate that all tools are properly registered with the MCP server
 * and that their schemas are correctly extracted, especially for complex schemas
 * that use .refine() methods (like update-event).
 */

describe('Tool Registration', () => {
  let mockServer: McpServer;
  let registeredTools: Array<{ name: string; description: string; inputSchema: any }>;

  beforeEach(() => {
    mockServer = new McpServer({ name: 'test', version: '1.0.0' });
    registeredTools = [];
    
    // Mock the registerTool method to capture registered tools
    mockServer.registerTool = vi.fn((name: string, definition: any, _handler: any) => {
      registeredTools.push({
        name,
        description: definition.description,
        inputSchema: definition.inputSchema
      });
      // Return a mock RegisteredTool
      return { name, description: definition.description } as any;
    });
  });

  it('should register all tools successfully without errors', async () => {
    // This should not throw any errors
    await expect(
      ToolRegistry.registerAll(mockServer, async () => ({ content: [] }))
    ).resolves.not.toThrow();
  });

  it('should register the correct number of tools', async () => {
    await ToolRegistry.registerAll(mockServer, async () => ({ content: [] }));
    
    const expectedToolCount = Object.keys(ToolSchemas).length;
    expect(registeredTools).toHaveLength(expectedToolCount);
  });

  it('should register all expected tool names', async () => {
    await ToolRegistry.registerAll(mockServer, async () => ({ content: [] }));
    
    const expectedTools = Object.keys(ToolSchemas);
    const registeredToolNames = registeredTools.map(t => t.name);
    
    for (const expectedTool of expectedTools) {
      expect(registeredToolNames).toContain(expectedTool);
    }
  });

  // update-event uses a ZodEffects wrapper (via .refine()) around its object shape;
  // extractSchemaShape must unwrap that or the MCP client sees an empty input schema
  // (the bug these tests were originally written to catch). Covering create-event,
  // list-events, and search-events alongside it confirms the extraction path handles
  // plain ZodObject schemas the same way.
  it.each([
    ['update-event', ['calendarId', 'eventId', 'modificationScope', 'originalStartTime', 'futureStartDate', 'start', 'end']],
    ['create-event', ['calendarId', 'summary', 'start', 'end']],
    ['list-events', ['calendarId', 'timeMin', 'timeMax']],
    ['search-events', ['calendarId', 'query', 'timeMin', 'timeMax']],
  ])('should extract a non-empty schema with expected properties for %s', async (toolName, expectedProps) => {
    await ToolRegistry.registerAll(mockServer, async () => ({ content: [] }));

    const tool = registeredTools.find(t => t.name === toolName);
    expect(tool).toBeDefined();

    const schema = tool!.inputSchema;
    for (const prop of expectedProps) {
      expect(schema).toHaveProperty(prop);
    }
  });

  it('should retrieve tools with schemas via getToolsWithSchemas(), a separate extraction path from registerAll()', () => {
    const tools = ToolRegistry.getToolsWithSchemas();

    const updateEventTool = tools.find(t => t.name === 'update-event');
    expect(updateEventTool).toBeDefined();
    // getToolsWithSchemas() returns a JSON Schema (via z.toJSONSchema), not a Zod
    // shape, so property names live under `properties` rather than at the top level.
    expect(updateEventTool!.inputSchema).toHaveProperty('properties.calendarId');
    expect(updateEventTool!.inputSchema).toHaveProperty('properties.modificationScope');
  });
});