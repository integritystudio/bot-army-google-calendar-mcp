# Schema.org Type Alignment - Quick Start Guide

**For**: Developers implementing Phase 1
**Time**: 4 days
**Effort**: 32 hours
**Target Date**: Week of 2026-03-31

---

## 📍 Where to Start

### Step 1: Understand the Goal (30 min)

Read in this order:
1. This file (5 min)
2. `docs/SCHEMA-ORG-QUICK-REFERENCE.md` (15 min)
3. `docs/SCHEMA-ORG-ANALYSIS-SUMMARY.md` (10 min)

**What you'll know**: Why we're doing this, what types align with schema.org, and the 3-phase roadmap.

### Step 2: Get the Full Implementation Plan (2 hours)

Read: `docs/IMPLEMENTATION-GUIDE.md`

**What you'll know**: Exact tasks for Days 1-4, code examples, file locations, testing strategy.

### Step 3: Set Up Your Environment (30 min)

```bash
# Clone/navigate to project
cd ~/code/is-internal/bot-army-google-calendar-mcp

# Install dependencies
npm install

# Add schema.org dependencies (for Phase 1)
npm install date-fns date-fns-tz

# Verify setup
npm run build
npm test

# All should pass ✅
```

### Step 4: Create Feature Branch (5 min)

```bash
# Create branch
git checkout -b feature/schema-org-alignment-phase1

# Push upstream
git push -u origin feature/schema-org-alignment-phase1
```

---

## 🎯 Phase 1 Summary

**Goal**: Align CalendarEvent type with schema.org Event

**Duration**: 4 days (32 hours)

**What Changes**:
- ✨ Add schema.org context to event responses
- ✨ Add JSON-LD properties to event objects
- ✨ Update documentation with examples
- ✅ Keep all existing code working (backward compatible)

**What Doesn't Change**:
- TypeScript types (CalendarEvent, etc.)
- Handler logic
- Google Calendar API calls
- Existing API contracts

---

## 📅 Day-by-Day Breakdown

### Day 1: Analysis & Planning (4 hours)

**Morning (2 hours)**:
1. Map response flows for 5 handlers (45 min)
   - CreateEventHandler
   - UpdateEventHandler
   - GetEventHandler
   - ListEventsHandler
   - SearchEventsHandler
   - Create: `docs/RESPONSE-FLOW-MAP.md`

2. Identify serialization points (45 min)
   - Where JSON is currently created
   - Where to add @context
   - Create: `docs/SERIALIZATION-POINTS.md`

**Afternoon (2 hours)**:
3. Create property mapping document (1 hour)
   - CalendarEvent field → Event property
   - Conversion logic for each
   - Create: `docs/PROPERTY-MAPPING.md`

4. Design serialization architecture (1 hour)
   - Choose between Serializer class or wrapper
   - Plan file structure
   - Create: `docs/SERIALIZATION-STRATEGY.md`

**End Result**: Architecture fully planned, ready to code

---

### Day 2: Core Implementation (4 hours)

**Morning (2 hours)**:
1. Create SchemaOrgSerializer service (1.5 hours)
   - File: `src/services/SchemaOrgSerializer.ts`
   - Implements Event serialization
   - Handles timezone, attendees, colors

2. Write unit tests (0.5 hours)
   - File: `src/tests/unit/services/SchemaOrgSerializer.test.ts`
   - 25+ test cases
   - Test run: `npm test`

**Afternoon (2 hours)**:
3. Integrate into 5 handlers (1 hour)
   - CreateEventHandler.ts (+15 lines)
   - UpdateEventHandler.ts (+15 lines)
   - GetEventHandler.ts (+15 lines)
   - ListEventsHandler.ts (+20 lines)
   - SearchEventsHandler.ts (+20 lines)

4. Update response schemas (1 hour)
   - File: `src/tools/registry.ts`
   - Update tool response definitions
   - Add @context, @type, schema.org properties

**End Result**: Core serialization working, all tests passing

---

### Day 3: JSON-LD & Edge Cases (4 hours)

**Morning (2 hours)**:
1. Create JSON-LD examples (1 hour)
   - File: `docs/JSON-LD-EXAMPLES.md`
   - 3 examples: simple, with attendees, all-day
   - Include validation notes

2. Update README (1 hour)
   - Add Schema.org Integration section
   - Link to JSON-LD examples
   - Explain backward compatibility

**Afternoon (2 hours)**:
3. Improve timezone handling (1.5 hours)
   - Implement ISO 8601 with UTC offset conversion
   - Use date-fns + date-fns-tz
   - Add comprehensive error handling
   - Test all edge cases

4. Add backward compatibility tests (0.5 hours)
   - Verify original event property intact
   - Verify older clients still work
   - Ensure no breaking changes

**End Result**: Full timezone support, backward compatibility verified

---

### Day 4: Testing & Documentation (4 hours)

**Morning (2 hours)**:
1. Create API documentation (1.5 hours)
   - File: `docs/API-SCHEMA-ORG.md`
   - Complete endpoint reference
   - Request/response examples
   - Validation information
   - Migration guide

2. Write integration tests (0.5 hours)
   - File: `src/tests/integration/schema-org.test.ts`
   - Test full MCP protocol flow
   - Test client interactions
   - 15+ integration tests

**Afternoon (2 hours)**:
3. Run full test suite (0.5 hours)
   - `npm test` - All tests pass
   - `npx tsc --noEmit` - No type errors
   - `npm run lint` - No lint errors

4. Create deployment guide (1.5 hours)
   - File: `docs/DEPLOYMENT-CHECKLIST.md`
   - Pre-deployment verification
   - Deployment steps
   - Post-deployment validation
   - Rollback procedures

**End Result**: Full test coverage, ready for deployment

---

## 🚀 Key Files to Create/Modify

### New Files (10 files)

```
src/services/
  └── SchemaOrgSerializer.ts (220 lines)
     Core serialization logic

src/tests/unit/services/
  └── SchemaOrgSerializer.test.ts (150 lines)
     Unit tests for serializer

src/tests/integration/
  └── schema-org.test.ts (120 lines)
     End-to-end tests

docs/
  ├── RESPONSE-FLOW-MAP.md (Day 1)
  ├── SERIALIZATION-POINTS.md (Day 1)
  ├── PROPERTY-MAPPING.md (Day 1)
  ├── SERIALIZATION-STRATEGY.md (Day 1)
  ├── JSON-LD-EXAMPLES.md (Day 3)
  ├── API-SCHEMA-ORG.md (Day 4)
  └── DEPLOYMENT-CHECKLIST.md (Day 4)
```

### Modified Files (8 files)

```
src/handlers/core/
  ├── CreateEventHandler.ts (+15 lines)
  ├── UpdateEventHandler.ts (+15 lines)
  ├── GetEventHandler.ts (+15 lines)
  ├── ListEventsHandler.ts (+20 lines)
  └── SearchEventsHandler.ts (+20 lines)

src/
  └── tools/registry.ts (+50 lines for schemas)

Root:
  ├── package.json (+2 dependencies: date-fns, date-fns-tz)
  └── README.md (+20 lines: Schema.org section)
```

---

## 💻 Code Template: SchemaOrgSerializer

Use this as your starting point:

```typescript
// src/services/SchemaOrgSerializer.ts

import { CalendarEvent, CalendarEventAttendee } from '../schemas/types';

export class SchemaOrgSerializer {
  serializeEvent(event: CalendarEvent) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      identifier: event.id,
      name: event.summary,
      startDate: this.formatDateTime(event.start),
      endDate: this.formatDateTime(event.end),
      location: event.location,
      attendee: this.serializeAttendees(event.attendees),
    };
  }

  private formatDateTime(dt: any): string | null {
    if (!dt) return null;
    if (dt.date && !dt.dateTime) return dt.date;
    // TODO: Handle timezone conversion
    return dt.dateTime;
  }

  private serializeAttendees(attendees: any[]): any[] {
    if (!attendees) return [];
    return attendees.map(a => ({
      '@type': 'Person',
      email: a.email,
      name: a.displayName,
    }));
  }
}
```

---

## 🧪 Testing Quick Reference

```bash
# Run all tests
npm test

# Run specific test file
npm test src/services/SchemaOrgSerializer.test.ts

# Run with coverage
npm test -- --coverage

# Run type check
npx tsc --noEmit

# Run linter
npm run lint

# Build
npm run build

# Start server (verify no errors)
npm start
```

**Expected Results**:
- ✅ 70+ tests passing
- ✅ 0 TypeScript errors
- ✅ 0 linting errors
- ✅ >80% code coverage

---

## 📝 Documentation Requirements

Each day produces documentation:

**Day 1**: Planning documents
- RESPONSE-FLOW-MAP.md
- SERIALIZATION-POINTS.md
- PROPERTY-MAPPING.md
- SERIALIZATION-STRATEGY.md

**Day 2-3**: Code + inline comments
- JSDoc comments on all public methods
- Test file comments explaining test purpose

**Day 3**: JSON-LD examples
- JSON-LD-EXAMPLES.md
- README.md updates

**Day 4**: API reference + deployment
- API-SCHEMA-ORG.md
- DEPLOYMENT-CHECKLIST.md

---

## ✅ Definition of Done (Phase 1)

Phase 1 is complete when:

- [x] SchemaOrgSerializer implemented & tested
- [x] 5 handlers updated with serialization
- [x] Response schemas updated in registry
- [x] 70+ tests passing (100% pass rate)
- [x] 0 TypeScript errors
- [x] 0 linting errors
- [x] >80% code coverage
- [x] Backward compatibility verified
- [x] JSON-LD examples created
- [x] API documentation complete
- [x] README updated with schema.org section
- [x] Deployment guide created
- [x] All changes committed & PR created

---

## 🔄 Git Workflow

```bash
# Day 1: Analysis & planning
git add docs/RESPONSE-FLOW-MAP.md docs/SERIALIZATION-*.md docs/PROPERTY-MAPPING.md
git commit -m "docs(phase1): analysis and planning documents"

# Day 2: Core implementation
git add src/services/ src/handlers/core/ src/tools/registry.ts
git commit -m "feat(phase1): implement SchemaOrgSerializer and handler integration"

# Day 3: JSON-LD & edge cases
git add docs/JSON-LD-EXAMPLES.md README.md src/services/
git commit -m "feat(phase1): timezone handling and JSON-LD examples"

# Day 4: Testing & documentation
git add docs/API-SCHEMA-ORG.md docs/DEPLOYMENT-CHECKLIST.md src/tests/
git commit -m "docs(phase1): API reference and deployment guide"

# Final: Create PR
git push origin feature/schema-org-alignment-phase1
# Then create PR on GitHub
```

---

## 🆘 Common Questions

**Q: Do I need to change CalendarEvent type?**
A: No. Only add serialization logic in handlers.

**Q: Will this break existing clients?**
A: No. Original event property is preserved.

**Q: How do I handle timezones?**
A: Use date-fns-tz to convert to ISO 8601 with UTC offset. See `convertToIso8601WithOffset` in template.

**Q: What about attendees without email?**
A: Filter them out or include just name. See `serializeAttendees` in template.

**Q: How do I validate responses?**
A: Use https://validator.schema.org/ to paste JSON responses.

**Q: Should I implement all edge cases on Day 2?**
A: Start simple (Day 2), add edge cases (Day 3).

**Q: What if tests fail?**
A: Debug locally, add test case, fix implementation, commit.

---

## 📖 Reference Documents

| Document | Purpose | Read Time |
|----------|---------|-----------|
| IMPLEMENTATION-GUIDE.md | Detailed day-by-day guide | 60 min |
| SCHEMA-ORG-QUICK-REFERENCE.md | Visual type mappings | 20 min |
| SCHEMA-ORG-ALIGNMENT.md | Complete analysis | 60 min |
| SCHEMA-ORG-MCP-TOOLS.md | MCP tool reference | 30 min |
| SCHEMA-ORG-INDEX.md | Navigation guide | 10 min |

---

## ⏱️ Time Allocation (32 hours)

| Task | Hours |
|------|-------|
| Day 1: Analysis & planning | 4 |
| Day 2: Core implementation | 4 |
| Day 3: JSON-LD & edge cases | 4 |
| Day 4: Testing & documentation | 4 |
| Code review & iteration | 4 |
| Deployment & validation | 4 |
| Documentation & cleanup | 4 |
| **Total** | **32** |

---

## 🎉 Success Indicators

When you're done with Phase 1, you should have:

1. ✅ Serializer service that converts events to schema.org format
2. ✅ 5 handlers updated to return schema.org context
3. ✅ 70+ passing tests
4. ✅ Complete API documentation
5. ✅ JSON-LD examples that validate
6. ✅ Backward compatibility preserved
7. ✅ Deployment guide for team
8. ✅ PR ready for code review

---

## 🚀 Next: Phase 2 (After Phase 1)

Once Phase 1 is complete, Phase 2 adds:
- Schedule type (free/busy)
- SearchAction (Gmail search)
- EmailMessage (email integration)
- Performance metrics

**Duration**: 6 days
**Expected start**: Week of 2026-04-07

---

**Quick Start Version**: 1.0
**Date**: 2026-03-24
**Status**: Ready to implement
**Questions?**: See IMPLEMENTATION-GUIDE.md for detailed answers
