---
description: Edit Umbraco document properties (or invoke AI agents) via the Management API from outside the backoffice UI
---

Use this skill when the user asks to change content on a page, update SEO fields, modify a property value, or call an AI agent to generate content — anything that would normally happen in the backoffice browser UI but needs to be done from Claude Code.

The Umbraco MCP server's tools are designed for the backoffice browser; from Claude Code we call the REST Management API directly using the same OAuth client credentials.

## Step 1 — Authenticate

Tokens expire in ~5 minutes (299 seconds). Re-authenticate before each logical operation group rather than relying on one token for long workflows.

```bash
curl -sk -X POST "https://localhost:44367/umbraco/management/api/v1/security/back-office/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=${UMBRACO_CLIENT_ID}&client_secret=${UMBRACO_CLIENT_SECRET}"
# Returns: { "access_token": "...", "token_type": "Bearer", "expires_in": 299 }
```

`UMBRACO_CLIENT_ID` and `UMBRACO_CLIENT_SECRET` live in `.env`. All endpoints below require `Authorization: Bearer {token}`.

## Step 2 — Key Management API endpoints

| Action | Method | Endpoint |
|--------|--------|----------|
| Document tree root | GET | `/umbraco/management/api/v1/tree/document/root?skip=0&take=100` |
| Document tree children | GET | `/umbraco/management/api/v1/tree/document/children?parentId={id}&skip=0&take=100` |
| Get document | GET | `/umbraco/management/api/v1/document/{id}` |
| Update document | PUT | `/umbraco/management/api/v1/document/{id}` |
| Document type tree root | GET | `/umbraco/management/api/v1/tree/document-type/root?skip=0&take=100` |
| Document type tree children | GET | `/umbraco/management/api/v1/tree/document-type/children?parentId={id}&skip=0&take=100` |
| Get document type | GET | `/umbraco/management/api/v1/document-type/{id}` |

## Step 3 — Workflow for updating page properties

1. **Find the document.** Walk the tree (`/tree/document/root` → `/tree/document/children?parentId=...`) to locate the target page by name.
2. **Read the document.** `GET /document/{id}` to retrieve current property values. The response includes a `values` array of `{ "alias": "title", "value": "..." }`.
3. **Identify property aliases.** If unsure of field names, `GET` the document type or its compositions to see available properties. Common compositions: SEO Controls (`metaName`, `metaDescription`, `metaKeywords`), Header Controls (`title`, `subtitle`).
4. **Build the update payload.** The `PUT` body requires `template`, `values`, and `variants` from the original document. Modify or add entries in `values`:
   ```json
   {
     "template": { "id": "..." },
     "values": [
       { "alias": "metaName", "culture": null, "segment": null, "value": "New SEO Title" },
       { "alias": "metaDescription", "culture": null, "segment": null, "value": "New description" }
     ],
     "variants": [{ "culture": null, "segment": null, "name": "Page Name", "state": "Draft" }]
   }
   ```
5. **Update the document.** `PUT /document/{id}` with the payload. HTTP 200 = success. This saves a draft; it does **not** publish.

## Step 4 — (Optional) Invoke an AI agent for content generation

AI agents configured in the backoffice can be invoked from Claude Code via the Agent API. Endpoints are under `/umbraco/ai/management/api/v1/agents/`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all agents |
| GET | `/{idOrAlias}` | Get agent by ID or alias |
| POST | `/{idOrAlias}/run` | Run agent (SSE stream) |

**Important:** Agent tools (`get_page_info`, `set_property_value`, `search_umbraco`) are **frontend/client-side tools** that only work inside the Copilot browser UI. When calling from Claude Code, provide the page content directly in the message and parse the agent's text response yourself.

```bash
curl -sk -N -X POST "https://localhost:44367/umbraco/ai/management/api/v1/agents/website-content-assistant/run" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"threadId":"t1","runId":"r1","messages":[{"id":"m1","role":"user","content":"Generate SEO for this article: ..."}]}'
```

The response is a Server-Sent Events stream. Extract text from `TEXT_MESSAGE_CHUNK` events and concatenate all `delta` values to assemble the full agent response:

```
data: {"type":"TEXT_MESSAGE_CHUNK","messageId":"...","role":"assistant","delta":"partial text"}
```

## Step 5 — Confirm with the user before destructive edits

Reading documents is safe. Writing them changes content the user may not have asked you to touch. Before issuing a `PUT`:

- Show the user the exact payload (or at least the `values` entries being added/changed).
- For bulk updates across multiple documents, confirm the scope first ("about to update X documents under /articles — proceed?").
- After the update, fetch the document again and confirm the new values are persisted.
