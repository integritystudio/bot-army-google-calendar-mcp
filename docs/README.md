# Documentation Index

Welcome to the Google Calendar MCP Server documentation.

## Getting Started

- [Main README](../README.md) - Quick start guide and overview
- [Authentication Setup](authentication.md) - Detailed Google Cloud setup instructions

## User Guides

- [Advanced Usage](advanced-usage.md) - Multi-account, batch operations, smart scheduling
- [Troubleshooting](troubleshooting.md) - Common issues and solutions

## Deployment

- [Deployment Guide](deployment.md) - HTTP transport and cloud deployment

## Development

- [Development Guide](development.md) - Contributing and development setup
- [Architecture Overview](architecture.md) - Technical architecture details
- [Testing Guide](testing.md) - Running and writing tests
- [Development Scripts](development-scripts.md) - Using the dev command system

## Reference

- [Org Tags Guide](ORG-TAGS-GUIDE.md) - Adding `Organization/*` sender tags; schema.org naming rules
- [Defined Terms Guide](DEFINED-TERMS-GUIDE.md) - Controlled vocabularies (`DefinedTerm`/`DefinedTermSet`) referenced by org tags
- [API Documentation](https://developers.google.com/calendar/api/v3/reference) - Google Calendar API
- [MCP Specification](https://modelcontextprotocol.io/docs) - Model Context Protocol

## Known Issues

Failure modes that are silent — the script reports success while doing nothing, or does
the wrong thing without erroring. Full detail in the
[main README](../README.md#known-issues).

| Issue | Effect |
|---|---|
| `ORG_TAGS` must hold no time-varying data | Dated events rot silently; `schema.event` lists recurring programmes, not instances |
| Parentheses break Gmail's `label:` operator | `label:"…(X)…"` returns 0 on a full label — strips, backfills and delete-guards all misread |
| `searchAndModify()` does not page | `relabel-messages.mjs` caps at 100 and still prints success |
| A filter can add only one user label | `Too many user labels in filter`; `messages.modify` has no such limit |
| Domain names do not reveal org type | 5 of 5 name-based guesses wrong; many domains are sending platforms, not orgs |

## Quick Links

### For Users
1. Start with the [Main README](../README.md)
2. Follow [Authentication Setup](authentication.md)
3. Check [Troubleshooting](troubleshooting.md) if needed

### For Developers
1. Read [Architecture Overview](architecture.md)
2. Set up with [Development Guide](development.md)
3. Run tests with [Testing Guide](testing.md)

### For Deployment
1. Review [Deployment Guide](deployment.md)
2. Check security considerations
3. Set up monitoring

## Need Help?

- [GitHub Issues](https://github.com/nspady/google-calendar-mcp/issues)
- [GitHub Discussions](https://github.com/nspady/google-calendar-mcp/discussions)