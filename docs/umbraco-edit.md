# Modifying Umbraco Content from Claude Code

Use the `/umbraco-edit` command to edit document properties or invoke an AI agent via the Management API from outside the backoffice. Covers the OAuth token dance, the document/document-type endpoint reference, the find → read → PUT workflow, and the Agent SSE stream parsing. Credentials (`UMBRACO_CLIENT_ID`, `UMBRACO_CLIENT_SECRET`) live in `.env`.
