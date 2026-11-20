# CurseForge API notes

- Official REST docs: https://docs.curseforge.com/rest-api/
- Minecraft mod search endpoint is `GET /v1/mods/search`.
- It requires `x-api-key` authentication and `gameId` query parameter. Minecraft game id is 432.
- Search parameters include `classId`, `searchFilter`, `gameVersion`, `gameVersions`, `modLoaderType`, `modLoaderTypes`, `sortField`, `sortOrder`, `index`, and `pageSize` (max 50; index + pageSize <= 10,000).
- ModLoaderType enum in the docs: 1 Forge, 4 Fabric, 5 Quilt, 6 NeoForge.
- Search response returns `data` records with id, name, slug, summary, downloadCount, authors, logo, latestFiles, latestFilesIndexes, dates and links.
- CurseForge support article: https://support.curseforge.com/support/solutions/articles/9000208346-about-the-curseforge-api-and-how-to-apply-for-a-key
- CurseForge says each third-party developer receives a unique API key after an application and Overwolf review. A launcher cannot safely ship a key unless the project owner has obtained and configured one.
- Public web search page is available at https://www.curseforge.com/minecraft/search and exposes search query parameters, but its HTML is not an official integration contract.

Implementation implication: add provider-aware search with Modrinth working without a key; expose CurseForge search only when a configured key exists, with a clear UI message otherwise. Do not scrape the public site as the primary integration and do not hardcode a key.
