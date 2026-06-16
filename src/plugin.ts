/**
 * Plugin Adapter for Voiden REST API Extension
 *
 * This adapter wraps the new UIExtension to work with the legacy Plugin system.
 * This is a transitional approach until the plugin system fully supports UIExtension.
 */

import type { CorePluginContext } from '@voiden/sdk/ui';
type PluginContext = CorePluginContext;
import { VoidenRestApiExtension } from './extension';
import { restApiHistoryAdapter } from './historyAdapter';
import { createResponseStatusNode } from './nodes/ResponseStatusNode';
import { createResponseHeadersNode } from './nodes/ResponseHeadersNode';
import { createRequestHeadersNode } from './nodes/RequestHeadersNode';
import { createResponseBodyNode } from './nodes/ResponseBodyNode';
import manifest from './manifest.json';
import React from 'react';
import { createResponseDocNode } from './nodes/ResponseDocNode';
// CopyCurlButton available inline on MethodNode — top-bar action removed

type EditorTab = { title?: string; content?: string; tabId?: string };


const voidenRestApiPlugin = (context: PluginContext) => {
  // Create extension instance
  const extension = new VoidenRestApiExtension();
  let currentTab: EditorTab | null = null;
  // Create a minimal UIExtensionContext that maps to PluginContext
  const createExtensionContext = () => {
    return {
      blocks: {
        register: (block: any) => {
          // TODO: Implement block registration via context.registerVoidenExtension
        },
        unregister: (name: string) => { },
        get: (name: string) => undefined,
        getAll: () => [],
      },
      slashCommands: {
        register: (command: any) => {
          context.addVoidenSlashCommand(command);
        },
        registerGroup: (group: any) => {
          context.addVoidenSlashGroup(group);
        },
        unregister: (name: string) => { },
        get: (name: string) => undefined,
        getAll: () => [],
        getGroups: () => [],
      },
      ui: {
        registerSidebar: (side: 'left' | 'right', tab: any) => {
          context.registerSidebarTab(side, tab);
        },
        registerPanel: (panel: any) => {
          context.registerPanel(panel.id, panel);
        },
        showModal: (modal: any) => {
        },
        closeModal: (id: string) => {
        },
        showToast: (message: string, type?: string) => {
        },
      },
      editor: {
        getActive: (type: 'voiden' | 'code') => {
          return context.project.getActiveEditor(type);
        },
        getAll: () => {
          return {
            voiden: context.project.getActiveEditor('voiden'),
            code: context.project.getActiveEditor('code'),
          };
        },
        focus: (type: 'voiden' | 'code') => {
          const editor = context.project.getActiveEditor(type);
          if (editor) {
            editor.commands.focus();
          }
        },
      },
      storage: {
        get: async (key: string) => {
          // TODO: Implement storage via electron
          return undefined;
        },
        set: async (key: string, value: any) => {
          // TODO: Implement storage via electron
        },
        delete: async (key: string) => {
          // TODO: Implement storage via electron
        },
        clear: async () => {
          // TODO: Implement storage via electron
        },
      },
      metadata: {
        name: extension.name,
        version: extension.version,
        description: extension.description,
        author: extension.author,
        icon: extension.icon,
      },
      request: {
        send: async (request: any, options?: any) => {
          // TODO: Implement request sending
          throw new Error('Request API not yet implemented in adapter');
        },
      },
      // Pipeline API - stub implementation
      // The actual request handling is done via context.onBuildRequest/onProcessResponse
      // This stub allows extensions to register hooks without errors
      pipeline: {
        registerHook: (stage: any, handler: any, priority?: number) => {
          // TODO: Map this to the appropriate context.onBuildRequest/onProcessResponse
          // For now, this is a no-op as the plugin adapter handles request building directly
        },
        unregisterHook: (stage: any, handler: any) => {
          // No-op
        },
        getHooks: (stage: any) => {
          return [];
        },
      },
    };
  };

  return {
    onload: async () => {

      // Load request nodes from plugin package
      const { createMethodNode } = await import('./nodes/MethodNode');
      const { createJsonNode } = await import('./nodes/JsonNode');
      const { createXMLNode } = await import('./nodes/XMLNode');
      const { createYmlNode } = await import('./nodes/YmlNode');
      const { UrlNode } = await import('./nodes/UrlNode');
      const {
        RequestNode,
        createHeadersTableNodeView,
        createQueryTableNodeView,
        createPathParamsTableNodeView,
        createURLTableNodeView,
        createMultipartTableNodeView,
        createCookiesTableNodeView,
        createOptionsTableNodeView
      } = await import('./nodes/index');
      const { createRestFileNode } = await import('./nodes/RestFile');

      // Create nodes with context components and hooks
      const { NodeViewWrapper, CodeEditor, RequestBlockHeader, Tip } = context.ui.components;
      const { useSendRestRequest, useParentResponseDoc, useResponseBodyHeight } = context.ui.hooks;

      const JsonNode = createJsonNode(NodeViewWrapper, CodeEditor, RequestBlockHeader, context.project.openFile);
      const XMLNode = createXMLNode(NodeViewWrapper, CodeEditor, RequestBlockHeader, context.project.openFile);
      const YmlNode = createYmlNode(NodeViewWrapper, CodeEditor, RequestBlockHeader, context.project.openFile);
      const MethodNode = createMethodNode(useSendRestRequest);
      const RestFile = createRestFileNode(NodeViewWrapper, RequestBlockHeader, context.project.openFile);

      // Create table nodes with RequestBlockHeader and openFile callback
      const HeadersTableNodeView = createHeadersTableNodeView(RequestBlockHeader, context.project.openFile);
      const QueryTableNodeView = createQueryTableNodeView(RequestBlockHeader, context.project.openFile);
      const PathParamsTableNodeView = createPathParamsTableNodeView(RequestBlockHeader, context.project.openFile);
      const URLTableNodeView = createURLTableNodeView(RequestBlockHeader, context.project.openFile);
      const MultipartTableNodeView = createMultipartTableNodeView(RequestBlockHeader, context.project.openFile);
      const CookiesTableNodeView = createCookiesTableNodeView(RequestBlockHeader, context.project.openFile);
      const OptionsTableNodeView = createOptionsTableNodeView(RequestBlockHeader, context.project.openFile);

      // Register Tiptap nodes for HTTP requests
      context.registerVoidenExtension(RequestNode);
      context.registerVoidenExtension(MethodNode);
      context.registerVoidenExtension(UrlNode);
      context.registerVoidenExtension(HeadersTableNodeView);
      context.registerVoidenExtension(QueryTableNodeView);
      context.registerVoidenExtension(PathParamsTableNodeView);
      context.registerVoidenExtension(URLTableNodeView);
      context.registerVoidenExtension(MultipartTableNodeView);
      context.registerVoidenExtension(CookiesTableNodeView);
      context.registerVoidenExtension(OptionsTableNodeView);
      context.registerVoidenExtension(JsonNode);
      context.registerVoidenExtension(XMLNode);
      context.registerVoidenExtension(YmlNode);
      context.registerVoidenExtension(RestFile);

      // Create and register response nodes using local implementations with context components

      const ResponseStatusNode = createResponseStatusNode(NodeViewWrapper);
      const ResponseHeadersNode = createResponseHeadersNode(NodeViewWrapper, CodeEditor, useParentResponseDoc);
      const RequestHeadersNode = createRequestHeadersNode(NodeViewWrapper, CodeEditor, useParentResponseDoc);
      const ResponseBodyNode = createResponseBodyNode(NodeViewWrapper, CodeEditor, useParentResponseDoc, useResponseBodyHeight, Tip);
      const ResponseDocNode = createResponseDocNode(NodeViewWrapper);
      context.registerVoidenExtension(ResponseStatusNode);
      context.registerVoidenExtension(ResponseHeadersNode);
      context.registerVoidenExtension(ResponseBodyNode);
      context.registerVoidenExtension(RequestHeadersNode);
      context.registerVoidenExtension(ResponseDocNode);

      // Register linkable node types (for external file linking)

      context.registerLinkableNodeTypes([
        // Request nodes (linkable)
        'request',
        'rest-request',
        'method',
        'url',
        'response-doc',
        'headers-table',
        'query-table',
        'path-table',
        'url-table',
        'multipart-table',
        'cookies-table',
        'options-table',
        'json_body',
        'xml_body',
        'yml_body',
        'restFile',
        'response-body',
        'response-headers',
        'request-headers',
        'response-status',
      ]);

      // Register display names for node types (for UI block picker)
      context.registerNodeDisplayNames({
        'request': 'Request',
        'rest-request': 'Request',
        'headers-table': 'Headers',
        'rest-headers': 'Headers',
        'json_body': 'Body',
        'rest-body': 'Body',
        'query-table': 'Query Params',
        'rest-query': 'Query Params',
        'cookies-table': 'Cookies',
        'options-table': 'Options',
        'path-table': 'Path Params',
        'rest-params': 'Path Params',
        'rest-file': 'File Upload',
        'response-doc': 'Response',
        'response-body': 'Response Body',
        'response-headers': 'Response Headers',
        'request-headers': 'Request Headers',
        'xml_body': 'XML Body',
        'yml_body': 'YAML Body',
      });


      // Register block outline metadata for the Block Overview panel.
      // Cast to any: registerBlockOutlineMeta is a host-injected API not yet in the published SDK type.
      (context as any).registerBlockOutlineMeta({
        request: {
          label: "Request",
          icon: "Send",
          // Render as a block card at its document position showing "METHOD URL" as preview.
          // method and url are internal children — skipped at top level via SKIP_TYPES in the panel.
          getPreview: (_attrs: Record<string, any>, textContent: string) => {
            if (!textContent) return undefined;
            const methods = ["DELETE", "OPTIONS", "PATCH", "POST", "PUT", "GET", "HEAD"];
            for (const m of methods) {
              if (textContent.startsWith(m)) {
                const url = textContent.slice(m.length);
                return url ? `${m} ${url}` : m;
              }
            }
            return textContent.length > 50 ? textContent.slice(0, 50) + "…" : textContent;
          },
        },
        method: { label: "Method", icon: "Zap" },
        url: { label: "URL", icon: "Globe" },
        "headers-table": {
          label: "Headers",
          icon: "Hash",
          getRowCount: (_attrs, childCount) => childCount > 0 ? childCount : undefined,
        },
        "query-table": {
          label: "Query Params",
          icon: "Search",
          getRowCount: (_attrs, childCount) => childCount > 0 ? childCount : undefined,
        },
        "path-table": {
          label: "Path Params",
          icon: "Route",
          getRowCount: (_attrs, childCount) => childCount > 0 ? childCount : undefined,
        },
        "cookies-table": {
          label: "Cookies",
          icon: "Cookie",
          getRowCount: (_attrs, childCount) => childCount > 0 ? childCount : undefined,
        },
        "options-table": {
          label: "Options",
          icon: "Settings2",
          getRowCount: (_attrs, childCount) => childCount > 0 ? childCount : undefined,
        },
        "url-table": {
          label: "URL Params",
          icon: "Globe",
          getRowCount: (_attrs, childCount) => childCount > 0 ? childCount : undefined,
        },
        "multipart-table": {
          label: "Multipart",
          icon: "Layers",
          getRowCount: (_attrs, childCount) => childCount > 0 ? childCount : undefined,
        },
        json_body: {
          label: "JSON Body",
          icon: "Braces",
          getPreview: (attrs) => attrs?.language || "json",
        },
        xml_body: {
          label: "XML Body",
          icon: "Code2",
          getPreview: () => "xml",
        },
        yml_body: {
          label: "YAML Body",
          icon: "AlignLeft",
          getPreview: () => "yaml",
        },
        restFile: {
          label: "File Upload",
          icon: "FileUp",
          getPreview: (attrs) => attrs?.fileName || undefined,
        },
      });

      // Register table cell autocomplete suggestions
      context.registerTableSuggestions('headers-table', {
        0: [
          { label: 'Accept' },
          { label: 'Accept-Encoding' },
          { label: 'Accept-Language' },
          { label: 'Authorization' },
          { label: 'Cache-Control' },
          { label: 'Content-Type' },
          { label: 'Cookie' },
          { label: 'Host' },
          { label: 'Origin' },
          { label: 'Referer' },
          { label: 'User-Agent' },
          { label: 'X-Requested-With' },
        ],
        1: [
          { label: 'application/json' },
          { label: 'application/xml' },
          { label: 'application/x-www-form-urlencoded' },
          { label: 'multipart/form-data' },
          { label: 'text/plain' },
          { label: 'text/html' },
          { label: 'text/xml' },
          { label: 'application/javascript' },
          { label: 'application/pdf' },
          { label: 'application/octet-stream' },
          { label: 'image/jpeg' },
          { label: 'image/png' },
        ],
      });

      context.registerTableSuggestions('options-table', {
        0: [
          { label: 'follow_redirects', description: 'Follow HTTP redirects (true/false)' },
        ],
        1: [
          { label: 'true' },
          { label: 'false' },
        ],
      });

      // Copy cURL button is available inline next to the endpoint (MethodNode)
      // Top-bar action removed to avoid duplication



      // Register request building handler
      context.onBuildRequest(async (request, editor) => {
        try {
          const editorJson = editor.getJSON();

          // Skip GraphQL and socket documents — those plugins handle their own building
          if (editorJson.content?.some((n: any) => n.type === 'gqlquery')) return request;
          if (editorJson.content?.some((n: any) => n.type === 'socket-request')) return request;

          // Get request-building utilities exposed via context
          const { getTable, parseAuthNode, buildHeadersWithCookies, findNode, findNodes, createNewRequestObject } = (context as any).helpers.requestUtils;

          // Import REST-block-specific builders from this plugin — these read json_body,
          // xml_body, yml_body, multipart-table, url-table, restFile node types.
          const { buildContentType, buildBodyParams, buildRequestBody, extractBinary } = await import('./lib/requestBuilder');

          // A getTable-compatible wrapper for requestBuilder functions that need it
          const getTableFn = (type: string, doc: any, env?: Record<string, string>) =>
            getTable(type as any, doc, env);

          // Read method and URL from the api/request container node
          const endpointNode = findNode(editorJson, "api") || findNode(editorJson, "request");
          const method = endpointNode?.content?.find((n: any) => n.type === "method")?.content?.[0]?.text || "GET";
          const url = endpointNode?.content?.find((n: any) => n.type === "url")?.content?.[0]?.text || "";

          const auth = parseAuthNode(editorJson);
          const optionsTable = getTable("options-table", editorJson, undefined);
          const options: Record<string, string> = {};
          for (const opt of optionsTable) { if (opt.enabled) options[opt.key] = opt.value; }

          const preRequestCodeBlock = findNode(editorJson, "pre_request_block")?.attrs?.body;
          const postRequestCodeBlock = findNodes(editorJson, "post_request_block")
            ?.map((n: any) => n?.attrs?.body).join('\n');

          const contentType = buildContentType(editorJson, getTableFn, undefined);

          const builtRequest = {
            ...createNewRequestObject({ method, url }),
            protocolType: 'rest',
            headers: buildHeadersWithCookies(editorJson, undefined),
            params: getTable("query-table", editorJson, undefined),
            path_params: getTable("path-table", editorJson, undefined),
            content_type: contentType,
            body_params: await buildBodyParams(editorJson, contentType),
            binary: extractBinary(editorJson),
            body: buildRequestBody(editorJson, getTableFn, undefined),
            prescript: preRequestCodeBlock,
            postscript: postRequestCodeBlock,
            auth: auth || request.auth,
            options,
          };

          return builtRequest;
        } catch (error) {
          throw error;
        }
      });

      // Register response processing handler
      context.onProcessResponse(async (response) => {
        const perfStart = performance.now();

        // Only handle REST protocol responses
        // GraphQL, gRPC, WebSocket are handled by their respective plugins
        const isRest = response.protocol && (response.protocol === 'rest' || response.protocol === 'http' || response.protocol === 'https');

        if (!isRest) {
          return;
        }

        try {
          // Dynamic import of response converter
          const importStart = performance.now();
          const { convertResponseToVoidenDoc } = await import('./lib/responseConverter');

          // Convert response to Voiden document
          const convertStart = performance.now();
          const responseDoc = convertResponseToVoidenDoc({
            statusCode: response.statusCode || response.status || 0,
            statusMessage: response.statusMessage || response.statusText || '',
            headers: response.headers || [],
            body: response.body || response.data,
            contentType: response.contentType,
            elapsedTime: response.elapsedTime || response.time || 0,
            url: response.url,
            requestMeta: response.requestMeta,
            metadata: response.metadata,
            wsId: response.wsId || '',
          });

          // Attach section info for "scroll to request" linking and color matching
          if (response.__sectionIndex !== undefined && responseDoc?.attrs) {
            responseDoc.attrs.sectionIndex = response.__sectionIndex;
          }
          if (response.__sectionColorIndex !== undefined && responseDoc?.attrs) {
            responseDoc.attrs.sectionColorIndex = response.__sectionColorIndex;
          }
          if (response.__sectionLabel && responseDoc?.attrs) {
            responseDoc.attrs.sectionLabel = response.__sectionLabel;
          }

          // Open a new Voiden tab with the response
          const openStart = performance.now();
          await context.openVoidenTab(
            `Response ${response.statusCode}`,
            responseDoc,
            { readOnly: true }
          );
        } catch (error) {
          console.error('[voiden-rest-api] onProcessResponse failed:', error);
        }
      });

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PASTE HANDLING
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // Import paste utilities
      const { convertCurlToRequest, pasteCurl } = await import('./index');
      const { showCurlPasteDialog, appendCurlAsNewSection } = await import('./nodes/curlPaste');

      // Register block owners (read from manifest)
      const blockTypes = manifest.capabilities.blocks.owns;
      const allowExtensions = manifest.capabilities.blocks.allowExtensions;

      blockTypes.forEach(blockType => {
        context.paste.registerBlockOwner({
          blockType,
          allowExtensions, // Read from manifest

          // Handle paste inside this block (e.g., pasting into method/url nodes)
          handlePasteInside: (text, html, node, view) => {
            if (blockType === 'method' || blockType === 'url') {
              // Strip formatting and insert as plain text
              let cleanedText = text.trim();

              // Extract plain text from HTML if present
              if (html && html.includes('<div>')) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                cleanedText = (tempDiv.textContent || tempDiv.innerText || text).trim();
              }

              // Strip fenced code block markers
              const tripleBacktickMatch = cleanedText.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/);
              if (tripleBacktickMatch) {
                cleanedText = tripleBacktickMatch[1].trim();
              }

              // Insert as plain text
              const tr = view.state.tr.replaceSelectionWith(view.state.schema.text(cleanedText));
              view.dispatch(tr);
              return true;
            }
            return false; // Other blocks use default paste
          },

          // Process block when pasted from clipboard
          processBlock: (block) => {
            // Could add validation/cleaning here
            return block;
          },
        });
      });

      // Register pattern handlers (read from manifest)
      const patterns = manifest.capabilities.paste.patterns;

      patterns.forEach(patternConfig => {

        // Parse regex pattern from manifest string (e.g., "/^curl\\s+/i" -> /^curl\s+/i)
        const patternMatch = patternConfig.pattern.match(/^\/(.+)\/([gimuy]*)$/);
        const regex = patternMatch
          ? new RegExp(patternMatch[1], patternMatch[2])
          : new RegExp(patternConfig.pattern);

        context.paste.registerPatternHandler({
          canHandle: (text) => {
            return regex.test(text.trim());
          },

          handle: (text, _html, _view) => {
            try {
              // Parse cURL command (sync check)
              const requests = convertCurlToRequest(text) as any[];
              if (!requests || requests.length === 0) {
                return false;
              }

              const request = requests[0];
              const editor = context.project.getActiveEditor('voiden');

              if (!editor) {
                return false;
              }

              if (!editor.isEmpty) {
                // Determine current section label for dialog
                const cursorPos = editor.state.selection.$from.pos;
                let sectionLabel: string | undefined;
                editor.state.doc.forEach((child: any, offset: number) => {
                  if (child.type.name === "request-separator" && offset < cursorPos) {
                    sectionLabel = child.attrs?.label || undefined;
                  }
                });

                showCurlPasteDialog(sectionLabel).then(async (choice) => {
                  if (choice === "replace") {
                    await pasteCurl(editor, request);
                  } else if (choice === "append") {
                    await appendCurlAsNewSection(editor, request);
                  }
                });
              } else {
                (async () => { await pasteCurl(editor, request); })();
              }

              return true;
            } catch (error) {
              return false;
            }
          },
        });
      });



      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // CURL IMPORTER: handle curl paste/replay in the editor (async, with file resolution)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if ((context as any).paste?.registerCurlImporter) {
        (context as any).paste.registerCurlImporter(async (curlString: string, editor: any) => {
          const { handleCurl, pasteCurl } = await import('./nodes/curlPaste');
          const request = handleCurl(curlString);
          if (!request) return false;
          await pasteCurl(editor, request);
          return true;
        });
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // EXPOSE HELPERS FOR OTHER PLUGINS
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      const { helpers } = await import('./lib/helpers');

      // Set up markdown converter function
      // This allows other plugins to convert JSONContent to markdown with proper frontmatter
      (window as any).__voidenMarkdownConverter__ = async (jsonContent: any) => {
        try {
          const { prosemirrorToMarkdown, getVoidenExtensions } = (context as any).helpers;
          const { getSchema } = await import('@tiptap/core');
          const schema = getSchema(getVoidenExtensions());

          // Convert to JSON string first (prosemirrorToMarkdown expects a string)
          const contentString = JSON.stringify(jsonContent);

          // Use the app's prosemirrorToMarkdown function which handles:
          // 1. Converting ProseMirror JSON to markdown
          // 2. Adding YAML frontmatter with version info
          // 3. Sanitizing inline code blocks
          const markdown = prosemirrorToMarkdown(contentString, schema);

          return markdown;
        } catch (error) {
          throw new Error('Failed to convert content to markdown. Make sure the editor is properly initialized.');
        }
      };

      // Expose helpers on window for other plugins
      if (!(window as any).__voidenHelpers__) {
        (window as any).__voidenHelpers__ = {};
      }

      (window as any).__voidenHelpers__['voiden-wrapper-api-extension'] = helpers;
      // Also expose under the correct extension name
      (window as any).__voidenHelpers__['voiden-rest-api'] = helpers;

      // ── Help commands ──────────────────────────────────────────────────────
      const {
        HttpHeadersHelp,
        HttpQueryParamsHelp,
        HttpUrlFormHelp,
        HttpMultipartFormHelp,
        HttpPathParamsHelp,
        HttpJsonBodyHelp,
        HttpXmlBodyHelp,
        HttpYmlBodyHelp,
        HttpCookiesHelp,
        RequestOptionsHelp,
      } = await import('./help/index');

      (context as any).registerHelpCommand?.({
        id: 'voiden-rest-api.help-headers',
        label: 'HTTP Headers',
        description: 'Learn about HTTP headers and how to use them',
        component: HttpHeadersHelp,
      });
      (context as any).registerHelpCommand?.({
        id: 'voiden-rest-api.help-query-params',
        label: 'Query Parameters',
        description: 'Learn about query parameters and how to use them',
        component: HttpQueryParamsHelp,
      });
      (context as any).registerHelpCommand?.({
        id: 'voiden-rest-api.help-url-form',
        label: 'URL-Encoded Form',
        description: 'Learn about URL-encoded form data',
        component: HttpUrlFormHelp,
      });
      (context as any).registerHelpCommand?.({
        id: 'voiden-rest-api.help-multipart-form',
        label: 'Multipart Form',
        description: 'Learn about multipart form data and file uploads',
        component: HttpMultipartFormHelp,
      });
      (context as any).registerHelpCommand?.({
        id: 'voiden-rest-api.help-path-params',
        label: 'Path Parameters',
        description: 'Learn about path parameters in URLs',
        component: HttpPathParamsHelp,
      });
      (context as any).registerHelpCommand?.({
        id: 'voiden-rest-api.help-json-body',
        label: 'JSON Body',
        description: 'Learn about sending JSON request bodies',
        component: HttpJsonBodyHelp,
      });
      (context as any).registerHelpCommand?.({
        id: 'voiden-rest-api.help-xml-body',
        label: 'XML Body',
        description: 'Learn about sending XML request bodies',
        component: HttpXmlBodyHelp,
      });
      (context as any).registerHelpCommand?.({
        id: 'voiden-rest-api.help-yml-body',
        label: 'YAML Body',
        description: 'Learn about sending YAML request bodies',
        component: HttpYmlBodyHelp,
      });
      (context as any).registerHelpCommand?.({
        id: 'voiden-rest-api.help-cookies',
        label: 'HTTP Cookies',
        description: 'Learn about sending cookies with requests',
        component: HttpCookiesHelp,
      });
      (context as any).registerHelpCommand?.({
        id: 'voiden-rest-api.help-request-options',
        label: 'Request Options',
        description: 'Learn about per-request configuration options',
        component: RequestOptionsHelp,
      });

      // Inject context into extension BEFORE calling onLoad
      const extensionContext = createExtensionContext();

      // Validate extension context before setting
      if (!extensionContext) {
        throw new Error('Failed to create extension context');
      }

      if (typeof (extension as any)._setContext !== 'function') {
        throw new Error('Extension does not have _setContext method');
      }

      (extension as any)._setContext(extensionContext);

      // Validate extension has required methods
      if (typeof extension.onLoad !== 'function') {
        throw new Error('Extension missing required onLoad method');
      }

      // Register history adapter so core delegates entry building to this plugin
      (context as any).registerHistoryAdapter?.(restApiHistoryAdapter);

      // Call extension's onLoad (this registers slash commands)
      await extension.onLoad();
    },
    onunload: async () => {
      await extension.onUnload?.();
    },
  };
};

export default voidenRestApiPlugin;
