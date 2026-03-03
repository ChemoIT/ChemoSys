# Phase 5: Settings and Observability - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

The admin can view a dashboard with live stats and recent activity, browse a filterable audit log of all system actions, and manage integration settings (SMS, WhatsApp, FTP, Telegram, LLM) — all stored in .env with a visual editor UI. The dashboard is a separate tab in the sidebar, not the landing page. No Config.ini — all settings managed through the "הגדרות מערכת" tab.

</domain>

<decisions>
## Implementation Decisions

### Dashboard design
- Dashboard is a **separate tab in the sidebar** (not the landing page after login)
- Stats display: Claude's discretion on layout (cards with numbers, mini-charts, etc.)
- Stats to show: active employees, active projects, total users, companies, departments, role tags
- Activity feed: **detailed list, 15-20 recent entries** from audit_log — showing who, what entity, what action, when, and on which entity
- Data loading: **fresh load on every page visit** (Server Component fetch) + **manual refresh button**
- No auto-refresh/polling

### Audit Log viewer
- **Extended filters**: entity type dropdown, action type dropdown (CREATE/UPDATE/DELETE), free-text search, date range picker
- **50 rows per page** with pagination
- **Expandable rows**: clicking a row reveals before/after field changes (from audit_log.changes JSONB)
- **Export**: Excel/CSV export button that exports the currently filtered data (uses the universal export Route Handler from Phase 4)

### Integration management (הגדרות מערכת)
- **5 integration types**: SMS (Micropay), WhatsApp, FTP, Telegram, LLM models (Gemini, OpenAI, etc.)
- **All config in .env** — no DB table for integrations. The settings page reads and writes to .env file
- **Type-specific fields**: each integration type has its own set of fields (Claude to determine based on each provider's API requirements; for SMS use the Micropay skill for field reference)
- **Test connection button** for each integration — sends a test request to verify config works
- **Enable/disable toggle** per integration — stored in .env as boolean
- After saving .env changes, the running process picks up the new values (implementation detail for Claude)

### Claude's Discretion
- Dashboard card layout, colors, and typography
- Exact stats to highlight (beyond the core: employees, projects, users)
- Loading skeletons and empty states
- Audit log table column order and widths
- Specific fields per integration type (research each provider's API)
- How to handle .env read/write at runtime (file system access, restart handling, etc.)
- Error state handling for failed test connections

</decisions>

<specifics>
## Specific Ideas

- For SMS integration fields, use the Micropay SMS skill as reference for required parameters
- LLM integration is forward-looking — for future AI agents in vehicle fleet cards. Needs: provider selection (OpenAI, Gemini, etc.), model name, API key
- The .env editor should feel like a settings panel with grouped sections — not a raw text editor
- Integration test button should give clear success/failure feedback (toast notification)

</specifics>

<deferred>
## Deferred Ideas

- AI agent integration in vehicle fleet cards — future module, but LLM settings infrastructure prepared in this phase
- Real-time dashboard with WebSocket/polling — not needed now, fresh load is sufficient
- Audit log retention/cleanup policy — add when data volume warrants it

</deferred>

---

*Phase: 05-settings-observability*
*Context gathered: 2026-03-03*
