> A plugin for [Voiden](https://github.com/VoidenHQ) — the developer-first API client.

# Voiden REST API

HTTP/REST API testing toolkit with an extensible request pipeline, rich body type support, environment variable substitution, and response visualization.

## Features

- HTTP method selection (GET, POST, PUT, DELETE, PATCH, etc.)
- URL building with path parameters and query strings
- Headers management with autocomplete
- Multiple body types: JSON, XML, YAML, HTML, form-data, URL-encoded, multipart
- File uploads via multipart/form-data
- Environment variable substitution
- cURL import via paste
- Response visualization with status, headers, and body
- Collapsible response sections
- Syntax highlighting for JSON and XML responses
- Request/response pipeline integration
- History API integration with custom cURL builder

## Usage

Use the `/request` slash command to insert a full REST request block. Individual blocks (`/headers`, `/query`, `/body`) can be added separately.

Paste a cURL command anywhere in the editor to auto-populate a request block.
