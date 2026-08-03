---
name: project-cloud-shared-secrets-one-shot
description: Umbraco Cloud shared secrets must be set up that way from the start — you cannot retroactively convert per-environment secrets to shared ones without regenerating
metadata: 
  node_type: memory
  type: project
  originSessionId: c9d416f6-42f3-4c6c-b40f-2825b7105f69
---

Umbraco Cloud's "shared secrets" / project-wide-secret-references feature must be set up from initial creation. Once a secret has been added as a per-environment app setting (e.g., `OpenAI__ApiKey` on Live only), Cloud does NOT offer a "convert this to a shared secret" option in the portal.

**Why:** The conversion path would require deleting the existing per-env secrets and recreating them as project-wide-shared. For OpenAI/Anthropic this means revoking + reissuing the actual API keys and re-distributing them everywhere they're referenced (Live env, local `appsettings.Development.json`, and any other Cloud env). For low-stakes demo projects the friction isn't worth it; for new projects, decide upfront.

**How to apply:** When introducing AI / API keys to a Cloud project for the first time, decide per-env vs. project-shared at the start. If shared is preferred, set them up as shared *before* adding any per-env value. After that point, per-env is the only practical option without a costly rotation.

Discovered 2026-05-26 during `arch-safety-net` Step 8 setup — wanted to share existing Live AI keys with the newly-needed Dev env; Cloud Portal didn't offer a conversion path.
