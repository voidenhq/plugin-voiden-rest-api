/**
 * cURL Command Generator
 *
 * Utilities for converting REST API request blocks into cURL commands
 */

interface RequestData {
    method?: string;
    url?: string;
    headers?: Array<{key: string, value: string}>;
    queryParams?: Array<{key: string, value: string}>;
    pathParams?: Array<{key: string, value: string}>;
    body?: string;
    bodyType?: 'json' | 'xml' | 'yaml' | 'form' | 'multipart' | 'text';
    multipartData?: Array<{key: string, value: string, type?: string}>;
}

/**
 * Substitute `{key}` path-param placeholders into a URL.
 * Mirrors core's applyPathParamsToUrl (getRequestFromJson.ts) — kept local so
 * curl generation doesn't depend on the app's env-substitution pipeline.
 */
const applyPathParams = (url: string, pathParams?: Array<{key: string, value: string}>): string => {
    if (!pathParams || pathParams.length === 0) return url;
    return pathParams.reduce((acc, {key, value}) => {
        if (!key) return acc;
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        return acc.replace(regex, encodeURIComponent(value || ''));
    }, url);
};

/**
 * Generate cURL command from request data
 */
export const generateCurlCommand = (data: RequestData): string => {
    const parts: string[] = ['curl'];

    // Add method
    const method = (data.method || 'GET').toUpperCase();
    if (method !== 'GET') {
        parts.push(`-X ${method}`);
    }

    // Build URL with path and query parameters
    let url = applyPathParams(data.url || '', data.pathParams);

    if (data.queryParams && data.queryParams.length > 0) {
        const queryString = data.queryParams
            .filter(({key, value}) => key.trim())
            .map(({key, value}) => `${encodeURIComponent(key.trim())}=${encodeURIComponent(value?.trim() || '')}`)
            .join('&');

        if (queryString) {
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}${queryString}`;
        }
    }

    // Add URL - use double quotes for better compatibility
    if (url) {
        parts.push(`"${url}"`);
    }

    // Add headers - BEFORE body/form data
    if (data.headers && data.headers.length > 0) {
        data.headers.forEach(({key, value}) => {
            if (key.trim()) {
                // Escape double quotes in header values
                const escapedValue = (value?.trim() || '').replace(/"/g, '\\"');
                parts.push(`-H "${key.trim()}: ${escapedValue}"`);
            }
        });
    }

    // Add body
    // Multipart only ever populates multipartData (never data.body), so it needs its
    // own branch outside the `data.body` guard below.
    if (data.bodyType === 'multipart' && data.multipartData && data.multipartData.length > 0) {
        // Multipart form data - use -F for each field
        data.multipartData.forEach(({key, value, type}) => {
            if (key.trim()) {
                const trimmedValue = value?.trim() || '';

                // Check if it's a file reference (starts with @)
                if (trimmedValue.startsWith('@')) {
                    // File upload
                    if (type) {
                        // With explicit content type
                        parts.push(`-F "${key.trim()}=${trimmedValue};type=${type}"`);
                    } else {
                        parts.push(`-F "${key.trim()}=${trimmedValue}"`);
                    }
                } else {
                    // Regular field - escape double quotes
                    const escapedValue = trimmedValue.replace(/"/g, '\\"');
                    parts.push(`-F "${key.trim()}=${escapedValue}"`);
                }
            }
        });
    } else if (data.body) {
        // If body is a file reference (binary) send as --data-binary without quotes
        if (typeof data.body === 'string' && data.body.startsWith('@')) {
            parts.push(`--data-binary "${data.body}"`);
        } else {
            // Regular body (JSON, XML, form-urlencoded, or text)
            // Escape double quotes and backslashes
            const escapedBody = data.body
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"');
            parts.push(`-d "${escapedBody}"`);

            // Add content-type header if not already present
            const hasContentType = data.headers?.some(({key}) =>
                key.toLowerCase() === 'content-type'
            );

            if (!hasContentType) {
                if (data.bodyType === 'json') {
                    parts.push(`-H "Content-Type: application/json"`);
                } else if (data.bodyType === 'xml') {
                    parts.push(`-H "Content-Type: application/xml"`);
                } else if (data.bodyType === 'yaml') {
                    parts.push(`-H "Content-Type: application/yaml"`);
                } else if (data.bodyType === 'form') {
                    parts.push(`-H "Content-Type: application/x-www-form-urlencoded"`);
                }
            }
        }
    }

    return parts.join(' \\\n  ');
};

/**
 * Adapt a full request object (from `getRequest`) to the internal `RequestData` shape
 * and generate a cURL command.
 */
export const generateCurlFromRequestObject = (req: any): string => {
    if (!req) return '';

    const data: RequestData = {} as RequestData;

    data.method = (req.method || req.verb || 'GET').toUpperCase();
    data.url = req.url || req.uri || req.request?.url || req.urlWithPathParams || req.urlWithPath || '';

    // Headers: expect array of { key, value, enabled? }
    const headersSrc = req.headers || req.request?.headers || [];
    data.headers = (headersSrc || [])
        .filter((h: any) => h && h.key && (h.enabled === undefined || h.enabled))
        .map((h: any) => ({ key: h.key, value: h.value || '' }));

    // Query params: support arrays from getRequest (params) or request.query
    const paramsSrc = req.params || req.query || req.request?.params || [];
    data.queryParams = (paramsSrc || [])
        .filter((p: any) => p && p.key && (p.enabled === undefined || p.enabled))
        .map((p: any) => ({ key: p.key, value: p.value || '' }));

    // Path params — substituted into the URL by generateCurlCommand
    const pathSrc = req.path_params || req.pathParams || req.request?.path_params || [];
    data.pathParams = (pathSrc || []).filter((p: any) => p && p.key).map((p: any) => ({ key: p.key, value: p.value || '' }));

    // Handle auth shortcuts
    if (req.auth) {
        const type = req.auth.type;
        const cfg = req.auth.config || {};
        if (type === 'bearer-token' && cfg.token) {
            data.headers = data.headers || [];
            data.headers.push({ key: 'Authorization', value: `${cfg.headerPrefix || 'Bearer'} ${cfg.token}` });
        } else if (type === 'basic-auth' && (cfg.username || cfg.password)) {
            const token = btoa(`${cfg.username || ''}:${cfg.password || ''}`);
            data.headers = data.headers || [];
            data.headers.push({ key: 'Authorization', value: `Basic ${token}` });
        } else if (type === 'api-key') {
            // api-key: config.key, config.value, config.in
            if (cfg.in === 'query') {
                data.queryParams = data.queryParams || [];
                data.queryParams.push({ key: cfg.key || '', value: cfg.value || '' });
            } else {
                data.headers = data.headers || [];
                data.headers.push({ key: cfg.key || '', value: cfg.value || '' });
            }
        }
    }

    // Body handling - priority: binary > content-type-driven (multipart/form-urlencoded
    // use body_params even if a stale body string exists) > body string > body_params.
    // Mirrors execution.ts's buildRestBody, which also lets content_type pick the branch
    // rather than trusting whichever of body/body_params happens to be non-empty.
    const contentType: string = (req.content_type || req.contentType || '').toLowerCase();
    const enabledParams = (req.body_params && Array.isArray(req.body_params))
        ? req.body_params.filter((p: any) => p && p.key && (p.enabled === undefined || p.enabled))
        : [];

    // Priority 1: Binary file (binary takes precedence)
    if (req.binary) {
        // extractBinary() can return a single path or string[] for multiple
        // attachments — a raw binary body can only carry one file, so use the first.
        const binaryPath = Array.isArray(req.binary) ? req.binary[0] : req.binary;
        if (typeof binaryPath === 'string' && binaryPath) {
            data.body = binaryPath.startsWith('@') ? binaryPath : `@${binaryPath}`;
            data.bodyType = 'text';
        }
    }
    // Priority 2: Multipart/form-urlencoded — driven by content-type, not by whichever
    // of body/body_params happens to be populated (a leftover json_body etc. must not
    // shadow the active multipart fields).
    else if (contentType.includes('multipart') && enabledParams.length > 0) {
        data.bodyType = 'multipart';
        data.multipartData = enabledParams.map((p: any) => {
            // File parameters: ensure @ prefix for curl -F
            const val = p.type === 'file' && typeof p.value === 'string'
                ? (p.value.startsWith('@') ? p.value : `@${p.value}`)
                : (p.value || '');
            return {
                key: p.key,
                value: val,
                type: p.contentType || p.mimeType // Include content type if specified
            };
        });
    }
    else if (contentType.includes('application/x-www-form-urlencoded') && enabledParams.length > 0) {
        data.bodyType = 'form';
        data.body = enabledParams
            .map((p: any) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value || '')}`)
            .join('&');
    }
    // Priority 3: Explicit body string (JSON/XML/text)
    else if (req.body && typeof req.body === 'string' && req.body.trim()) {
        if (req.body.startsWith('@')) {
            // binary file reference
            data.body = req.body;
            data.bodyType = 'text';
        } else if (contentType.includes('application/json')) {
            data.body = req.body;
            data.bodyType = 'json';
        } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
            data.body = req.body;
            data.bodyType = 'xml';
        } else if (contentType.includes('yaml')) {
            data.body = req.body;
            data.bodyType = 'yaml';
        } else {
            data.body = req.body;
            data.bodyType = 'text';
        }
    }
    // Priority 4: Body parameters reconstructed as JSON (no explicit content-type match)
    else if (enabledParams.length > 0) {
        if (contentType.includes('application/json')) {
            data.bodyType = 'json';
            // Reconstruct JSON object from key-value params
            const obj: Record<string, any> = {};
            enabledParams.forEach((p: any) => {
                obj[p.key] = p.value;
            });
            try {
                data.body = JSON.stringify(obj, null, 2);
            } catch (e) {
                console.error('Failed to construct JSON from params:', e);
                data.body = '';
            }
        } else {
            // Default to form-urlencoded
            data.bodyType = 'form';
            data.body = enabledParams
                .map((p: any) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value || '')}`)
                .join('&');
        }
    }

    // For multipart, DO NOT add Content-Type header manually
    // curl -F automatically sets it with the boundary
    const hasContentType = (data.headers || []).some(h => h.key && h.key.toLowerCase() === 'content-type');
    if (!hasContentType && data.bodyType !== 'multipart') {
        if (data.bodyType === 'json') {
            data.headers = [...(data.headers||[]), { key: 'Content-Type', value: 'application/json' }];
        } else if (data.bodyType === 'xml') {
            data.headers = [...(data.headers||[]), { key: 'Content-Type', value: 'application/xml' }];
        } else if (data.bodyType === 'yaml') {
            const yamlMime = (req.content_type || req.contentType || '').includes('x-yaml') ? 'application/x-yaml' : 'application/yaml';
            data.headers = [...(data.headers||[]), { key: 'Content-Type', value: yamlMime }];
        } else if (data.bodyType === 'form') {
            data.headers = [...(data.headers||[]), { key: 'Content-Type', value: 'application/x-www-form-urlencoded' }];
        }
    }

    return generateCurlCommand(data);
};

/**
 * Resolve a file-link path to an absolute path so the generated cURL command
 * works regardless of the shell's working directory. Mirrors the same
 * isAbsolute check used by historyManager's buildCurlFromEntry — a leading
 * "/" alone isn't proof of being filesystem-absolute, since fileLink nodes
 * store project-relative paths like "/README.md".
 */
const resolveAbsoluteFilePath = (filePath: string, activeProject?: string): string => {
    if (!activeProject || !filePath) return filePath;
    const isAbsolute = filePath.startsWith(activeProject) || /^[A-Za-z]:[/\\]/.test(filePath);
    if (isAbsolute) return filePath;
    return activeProject.replace(/[/\\]+$/, '') + '/' + filePath.replace(/^[/\\]+/, '');
};

/**
 * Generate cURL command directly from a (section-scoped) ProseMirror JSON doc.
 *
 * core's getRequest() deliberately does NOT populate body/content_type/
 * body_params/binary for REST — those are owned by this plugin's own
 * onBuildRequest (see plugin.ts) which reads json_body/xml_body/yml_body/
 * multipart-table/url-table/restFile node types. Mirror that exact
 * construction here so cURL output matches what actually gets sent.
 *
 * @param doc - Section-scoped editor JSON (e.g. via extractSectionDocByIndex)
 */
export const generateCurlFromJson = async (
    doc: any
): Promise<string> => {
    // Dynamic import of core request-building helpers (path resolved at runtime in app context)
    // @ts-ignore
    const { getTable, parseAuthNode, buildHeadersWithCookies, findNode, createNewRequestObject } =
        await import(/* @vite-ignore */ '@/core/request-engine/getRequestFromJson');

    const { buildContentType, buildBodyParams, buildRequestBody, extractBinary } = await import('./requestBuilder');

    const endpointNode = findNode(doc, "api") || findNode(doc, "request");
    const method = endpointNode?.content?.find((n: any) => n.type === "method")?.content?.[0]?.text || "GET";
    const url = endpointNode?.content?.find((n: any) => n.type === "url")?.content?.[0]?.text || "";

    const auth = parseAuthNode(doc);
    const contentType = buildContentType(doc, getTable, undefined);

    const requestData = {
        ...createNewRequestObject({ method, url }),
        headers: buildHeadersWithCookies(doc, undefined),
        params: getTable("query-table", doc, undefined),
        path_params: getTable("path-table", doc, undefined),
        content_type: contentType,
        body_params: await buildBodyParams(doc, contentType),
        binary: extractBinary(doc),
        body: buildRequestBody(doc, getTable, undefined),
        auth,
    };

    // File-link attrs store project-relative paths. Resolve them to absolute
    // paths so the copied cURL command works outside the project's directory.
    let activeProject: string | undefined;
    try {
        // @ts-ignore - resolved at runtime in app context
        const { getQueryClient } = await import(/* @vite-ignore */ '@/main');
        const projects = getQueryClient().getQueryData(["projects"]) as { activeProject?: string } | undefined;
        activeProject = projects?.activeProject;
    } catch {
        // Not running inside the app shell (e.g. tests) — leave paths as-is.
    }

    if (activeProject) {
        if (typeof requestData.binary === 'string') {
            requestData.binary = resolveAbsoluteFilePath(requestData.binary, activeProject);
        } else if (Array.isArray(requestData.binary)) {
            requestData.binary = requestData.binary.map((p: any) =>
                typeof p === 'string' ? resolveAbsoluteFilePath(p, activeProject) : p
            );
        }
        if (Array.isArray(requestData.body_params)) {
            requestData.body_params = requestData.body_params.map((p: any) =>
                p.type === 'file' && typeof p.value === 'string'
                    ? { ...p, value: resolveAbsoluteFilePath(p.value, activeProject) }
                    : p
            );
        }
    }

    return generateCurlFromRequestObject(requestData);
};