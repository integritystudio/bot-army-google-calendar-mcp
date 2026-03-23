# Project Directory Structure

## Current Structure (Updated 2025-11-17)

```
bot-army-google-calendar-mcp/
├── build/                      # Compiled JavaScript output
│   ├── auth-server.js         # Compiled authentication server
│   ├── index.js               # Compiled main entry point
│   └── *.js.map               # Source maps for debugging
│
├── docs/                       # Project documentation
│   ├── llm/                   # LLM-specific documentation
│   │   └── smart-event-detection/
│   ├── advanced-usage.md      # Advanced features guide
│   ├── architecture.md        # System architecture
│   ├── authentication.md      # OAuth setup guide
│   ├── deployment.md          # Deployment instructions
│   ├── development.md         # Development guide
│   ├── docker.md              # Docker usage
│   ├── testing.md             # Testing guide
│   └── README.md              # Documentation index
│
├── examples/                   # Example usage
│   ├── http-client.js         # HTTP client example
│   ├── http-with-curl.sh      # cURL examples
│   └── README.md
│
├── future_features/            # Future feature planning
│   └── ARCHITECTURE_REDESIGN.md
│
├── instructions/               # Project instructions
│   └── file_structure.md      # This file
│
├── modelcontextprotocol/       # ⚠️ SEPARATE PROJECT - Should be moved
│   └── perplexity-ask/        # Perplexity MCP Server (unrelated)
│
├── scripts/                    # Build and utility scripts
│   ├── account-manager.js     # Account management utilities
│   ├── build.js               # Build script
│   ├── dev.js                 # Development server
│   ├── test-docker.sh         # Docker testing
│   └── README.md
│
├── src/                        # TypeScript source code
│   ├── auth/                  # Authentication module
│   │   ├── client.ts          # OAuth client
│   │   ├── server.ts          # Auth server
│   │   ├── tokenManager.ts    # Token management
│   │   ├── utils.ts           # Auth utilities
│   │   ├── paths.js/paths.d.ts # Path configurations
│   │   └── README.md
│   │
│   ├── config/                # Configuration
│   │   ├── TransportConfig.ts # Transport layer config
│   │   └── README.md
│   │
│   ├── handlers/              # MCP tool handlers
│   │   ├── core/              # Core handler implementations
│   │   │   ├── BaseToolHandler.ts
│   │   │   ├── BatchRequestHandler.ts
│   │   │   ├── CreateEventHandler.ts
│   │   │   ├── DeleteEventHandler.ts
│   │   │   ├── FreeBusyEventHandler.ts
│   │   │   ├── GetCurrentTimeHandler.ts
│   │   │   ├── GetEventHandler.ts
│   │   │   ├── ListCalendarsHandler.ts
│   │   │   ├── ListColorsHandler.ts
│   │   │   ├── ListEventsHandler.ts
│   │   │   ├── RecurringEventHelpers.ts
│   │   │   ├── SearchEventsHandler.ts
│   │   │   ├── UpdateEventHandler.ts
│   │   │   └── README.md
│   │   ├── utils/             # Handler utilities
│   │   │   └── datetime.ts    # Date/time utilities
│   │   ├── utils.ts           # Shared handler utilities
│   │   └── README.md
│   │
│   ├── schemas/               # TypeScript schemas & validation
│   │   ├── types.ts           # Type definitions
│   │   └── README.md
│   │
│   ├── services/              # Business logic services
│   │   └── conflict-detection/ # Event conflict detection
│   │       ├── ConflictAnalyzer.ts
│   │       ├── ConflictDetectionService.ts
│   │       ├── EventSimilarityChecker.ts
│   │       ├── config.ts
│   │       ├── index.ts
│   │       ├── types.ts
│   │       └── README.md
│   │
│   ├── tests/                 # Test suites
│   │   ├── integration/       # Integration tests
│   │   │   ├── claude-mcp-integration.test.ts
│   │   │   ├── conflict-detection-integration.test.ts
│   │   │   ├── direct-integration.test.ts
│   │   │   ├── docker-integration.test.ts
│   │   │   ├── openai-mcp-integration.test.ts
│   │   │   ├── test-data-factory.ts
│   │   │   └── README.md
│   │   │
│   │   └── unit/              # Unit tests
│   │       ├── handlers/      # Handler tests
│   │       ├── schemas/       # Schema tests
│   │       ├── services/      # Service tests
│   │       ├── utils/         # Utility tests
│   │       ├── console-statements.test.ts
│   │       ├── index.test.ts
│   │       └── README.md
│   │
│   ├── tools/                 # MCP tools registry
│   │   ├── registry.ts        # Tool registration
│   │   └── README.md
│   │
│   ├── transports/            # MCP transport layers
│   │   ├── http.ts            # HTTP transport
│   │   ├── stdio.ts           # STDIO transport
│   │   └── README.md
│   │
│   ├── utils/                 # Shared utilities
│   │   ├── event-id-validator.ts
│   │   ├── field-mask-builder.ts
│   │   └── README.md
│   │
│   ├── auth-server.ts         # Authentication server entry
│   ├── index.ts               # Main MCP server entry
│   ├── server.ts              # Server implementation
│   └── README.md
│
├── .gitignore                 # Git ignore patterns
├── AGENTS.md                  # Agent configuration docs
├── docker-compose.yml         # Docker Compose configuration
├── Dockerfile                 # Docker image definition
├── gcp-oauth.keys.example.json # OAuth config template
├── gcp-oauth.keys.json        # ⚠️ OAuth credentials (should be gitignored)
├── LICENSE                    # MIT License
├── package.json               # NPM package configuration
├── package-lock.json          # NPM dependency lock
├── README.md                  # Main project README
├── tsconfig.json              # TypeScript configuration
├── tsconfig.lint.json         # TypeScript linting config
└── vitest.config.ts           # Vitest test configuration
```

## Key Directories

### Source Code (`src/`)
- **auth/**: Google OAuth authentication flow
- **handlers/**: MCP tool request handlers for calendar operations
- **schemas/**: Type definitions and validation schemas
- **services/**: Business logic (conflict detection, etc.)
- **tools/**: MCP tool registry and definitions
- **transports/**: Communication layer (HTTP and STDIO)
- **tests/**: Comprehensive test suites

### Configuration Files
- **package.json**: Project metadata and dependencies
- **tsconfig.json**: TypeScript compiler settings
- **vitest.config.ts**: Test framework configuration
- **docker-compose.yml**: Multi-container Docker setup

### Build Output
- **build/**: Compiled JavaScript (generated from TypeScript)

## Architecture Overview

This is a Model Context Protocol (MCP) server that provides Google Calendar integration for AI assistants.

**MCP Flow:**
1. Client (Claude Desktop, etc.) connects via STDIO or HTTP transport
2. Client lists available tools from `tools/registry.ts`
3. Client calls tools which route to appropriate handlers in `handlers/core/`
4. Handlers use `auth/` for Google API authentication
5. Handlers call Google Calendar API and return formatted responses
6. Services like `conflict-detection/` provide additional intelligence

## Development Workflow

1. Edit TypeScript files in `src/`
2. Run `npm run dev` for auto-rebuild during development
3. Run `npm run build` to compile TypeScript to `build/`
4. Run `npm run test` for unit tests
5. Run `npm run auth` to set up OAuth credentials

## Notes

⚠️ **Security:** The `gcp-oauth.keys.json` file contains sensitive OAuth credentials and should NEVER be committed to version control. Use `gcp-oauth.keys.example.json` as a template.

⚠️ **Cleanup Needed:** The `modelcontextprotocol/` directory contains a completely separate Perplexity MCP server project and should be moved to its own repository.

## Cleanup Performed (2025-11-17)

The following files were removed as they were auto-generated and redundant:
- 30+ `repomix-output.xml` files (generated documentation, ~1.5MB total)
- 15+ `README_ENHANCED.md` files (auto-generated metadata duplicates)

These files are now included in `.gitignore` to prevent future accumulation.
