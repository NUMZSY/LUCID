# LUCID launcher fixes

## Implementation

Fix the launchpad composition by making the main home column explicitly stretch to its grid track, adding overflow-safe width constraints, and reducing the side rail/aside pressure at desktop widths. Preserve the current LUCID visual language but give the selected instance a full-width play surface.

Keep Modrinth `.mrpack` imports isolated: the existing core flow already creates a new instance before installing files and deletes it on failure. Clarify this in the UI copy and success toast so an import cannot be mistaken for installing into the selected instance.

Add a provider-aware Browse search. Modrinth remains the default and retains one-click install. CurseForge search uses its official REST API only when `LUCID_CURSEFORGE_API_KEY` or `CURSEFORGE_API_KEY` is configured in the main process environment; results normalize into the existing browse model and open the CurseForge project page rather than downloading files without an approved API integration. Without a key, the client explains the configuration requirement and offers the public CurseForge search page.

## Project structure

- `launcher/src/renderer/app.ts`: home/import copy and provider-aware Browse UI.
- `launcher/src/renderer/styles.css`: final layout overrides for the home launch surface and responsive Browse controls.
- `launcher/src/shared/api.d.ts`: shared provider/search result contracts.
- `launcher/src/main/preload.ts`: expose CurseForge search and availability to the renderer.
- `launcher/src/main/ipc.ts`: validate provider search requests and dispatch to services.
- `launcher/src/core/mods/CurseForge.ts`: official CurseForge API adapter and normalized search results.
- `docs/curseforge-api-notes.md`: verified API constraints and source links.

## Design

Three candidate directions: restrained launchpad — 0.06; information-dense mod library — 0.08; neon gaming dashboard — 0.07. Choose restrained launchpad.

- **Design Movement:** restrained launchpad with a quiet technical control-room feel.
- **Core Principles:** the selected world owns the page; secondary actions stay discoverable; wide surfaces should breathe; provider differences are explicit.
- **Color Philosophy:** dark blue-black surfaces keep attention on the pale ice accent while provider/status labels use subtle contrast instead of alarm colors.
- **Layout Paradigm:** one dominant stretched launch surface with a narrow supporting rail, not a centered card floating in unused space.
- **Signature Elements:** the orbit/grid launch scene, compact status chips, and provider segmented control.
- **Interaction Philosophy:** actions explain their effect before the click; installs are disabled or redirected when the provider cannot safely complete them.
- **Animation:** retain the existing short fade/lift transitions; no new motion for search or layout.
- **Typography System:** Monocraft for labels and instance identity, existing system fallback for dense metadata.
- **Brand Essence:** a calm, safety-first Minecraft launcher for separate worlds and trusted mod sources; focused, transparent, protective.
- **Brand Voice:** “Import as a new instance.” “Search both catalogs; install only where the source is supported.”
- **Wordmark & Logo:** keep the existing pixel snowball mark and LUCID rail treatment.
- **Signature Brand Color:** `#7fcbff` ice blue.
