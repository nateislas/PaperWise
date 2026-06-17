# VectifyAI PageIndex Integration Guide

This guide explains how PageIndex is integrated into PaperWise and how you can configure the PageIndex MCP server in your local editor (Cursor or Claude Desktop) for reasoning-based document search.

---

## 1. Application Integration (PaperWise Backend)

In PaperWise, PageIndex is integrated programmatically using the Python `pageindex` SDK.

### Ingestion & Background Processing
When you import or upload a PDF, the background Celery worker:
1. Parses and extracts sections, methodology, and results.
2. If `PAGEINDEX_API_KEY` is configured, pre-submits the file using the SDK:
   ```python
   from pageindex import PageIndexClient
   pi_client = PageIndexClient(api_key=settings.pageindex_api_key)
   pi_result = pi_client.submit_document(file_path)
   doc_id = pi_result.get("doc_id")
   ```
3. Caches the `doc_id` in the paper's `metadata.json` file.

### Chat & Q&A
When you query the chatbot:
1. If PageIndex is active, the backend checks if indexing has finished using `pi_client.is_retrieval_ready(doc_id)`.
2. Once ready, it queries PageIndex with inline citations enabled:
   ```python
   response = pi_client.chat_completions(
       messages=history,
       doc_id=doc_id,
       enable_citations=True
   )
   ```
3. The response is parsed to convert citation tags like `<doc=...;page=3>` into academic bracket footnotes (`[3]`), and the referenced pages are returned as UI chip sources.

---

## 2. Developer MCP Setup (Cursor & Claude Desktop)

PageIndex exposes a Model Context Protocol (MCP) server that allows your AI coding assistant (like Cursor or Claude Desktop) to query documents directly from your IDE workspace.

### For Cursor
Add the following block to your Cursor Settings under **Features** > **MCP**:

1. Click **+ Add New MCP Server**.
2. Fill in the details:
   - **Name**: `pageindex`
   - **Type**: `command`
   - **Command**:
     ```bash
     npx -y @vectify/pageindex-mcp
     ```
3. Add the environment variable:
   - **Key**: `PAGEINDEX_API_KEY`
   - **Value**: `your_pageindex_api_key_here`

### For Claude Desktop
Add this to your Claude Desktop config file (typically `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "pageindex": {
      "command": "npx",
      "args": [
        "-y",
        "@vectify/pageindex-mcp"
      ],
      "env": {
        "PAGEINDEX_API_KEY": "your_pageindex_api_key_here"
      }
    }
  }
}
```

Once configured, your editor's AI will be equipped with tools to search, parse, and query documents directly within your workspace context!
