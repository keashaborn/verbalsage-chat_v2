
## 2026-06-16 — UI Cleanup and Auto-Titles

### Completed

- Vantage Profile UI wording was reframed away from "presets" toward durable "Vantages."
- Vantage management actions were tucked into a collapsed "Manage Vantage" section.
- Advanced Vantage controls were moved into a collapsed "Advanced tuning" section.
- The main Vantage Profile screen is now cleaner and less cockpit-like while retaining expert controls.
- Added thread auto-title generation:
  - New chats no longer remain as "New chat" after the first meaningful user message.
  - `/api/threads/[thread_id]/auto-title` generates a short title.
  - Thread title is saved through the existing Brains thread rename path.
  - Sidebar refreshes after auto-title.
  - Fallback deterministic title exists if the LLM call fails.

### Next Likely Target

Build a cleaner "Manage Vantages" workflow:

- Create Vantage
- Rename Vantage
- Duplicate Vantage
- Archive/Delete Vantage
- Set default Vantage
- Assign Vantage type

Keep Character Studio, rooms, avatar generation, and public character templates deferred until the Core Vantage model is stable.
