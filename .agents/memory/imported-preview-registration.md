---
name: Imported preview registration
description: Avoid source replacement and stale artifact registration when setting up an imported app.
---

Registering an imported app for the preview must preserve its source and existing stack; artifact scaffolding is not permission to replace the imported UI.

**Why:** Artifact creation requires an unused directory and generates starter files. Directory moves can trigger the artifact watcher to remove registration even when the original metadata is subsequently restored.

**How to apply:** Preserve imported files before any scaffold operation. If registration disappears after directory restoration, use the supported metadata validation/replacement flow to refresh it rather than rebuilding or restructuring the app.
