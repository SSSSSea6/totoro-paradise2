import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

const ensureRealtime = () => {
  let pkgJsonPath;
  try {
    pkgJsonPath = require.resolve('@supabase/realtime-js/package.json');
  } catch {
    console.warn('[ensure-supabase-constants] @supabase/realtime-js not installed, skipping.');
    return;
  }

  const pkgDir = dirname(pkgJsonPath);
  const pkgVersion = JSON.parse(readFileSync(pkgJsonPath, 'utf8')).version || '0.0.0';

  const targetFiles = {
    moduleConstants: join(pkgDir, 'dist/module/lib/constants.js'),
    mainConstants: join(pkgDir, 'dist/main/lib/constants.js'),
    moduleVersion: join(pkgDir, 'dist/module/lib/version.js'),
    mainVersion: join(pkgDir, 'dist/main/lib/version.js'),
  };

  const fallback = {
    moduleConstants: `import { version } from './version';
export const DEFAULT_VERSION = \`realtime-js/\${version}\`;
export const VSN_1_0_0 = '1.0.0';
export const VSN_2_0_0 = '2.0.0';
export const DEFAULT_VSN = VSN_1_0_0;
export const VERSION = version;
export const DEFAULT_TIMEOUT = 10000;
export const WS_CLOSE_NORMAL = 1000;
export const MAX_PUSH_BUFFER_SIZE = 100;
export var SOCKET_STATES;
(function (SOCKET_STATES) {
    SOCKET_STATES[SOCKET_STATES["connecting"] = 0] = "connecting";
    SOCKET_STATES[SOCKET_STATES["open"] = 1] = "open";
    SOCKET_STATES[SOCKET_STATES["closing"] = 2] = "closing";
    SOCKET_STATES[SOCKET_STATES["closed"] = 3] = "closed";
})(SOCKET_STATES || (SOCKET_STATES = {}));
export var CHANNEL_STATES;
(function (CHANNEL_STATES) {
    CHANNEL_STATES["closed"] = "closed";
    CHANNEL_STATES["errored"] = "errored";
    CHANNEL_STATES["joined"] = "joined";
    CHANNEL_STATES["joining"] = "joining";
    CHANNEL_STATES["leaving"] = "leaving";
})(CHANNEL_STATES || (CHANNEL_STATES = {}));
export var CHANNEL_EVENTS;
(function (CHANNEL_EVENTS) {
    CHANNEL_EVENTS["close"] = "phx_close";
    CHANNEL_EVENTS["error"] = "phx_error";
    CHANNEL_EVENTS["join"] = "phx_join";
    CHANNEL_EVENTS["reply"] = "phx_reply";
    CHANNEL_EVENTS["leave"] = "phx_leave";
    CHANNEL_EVENTS["access_token"] = "access_token";
})(CHANNEL_EVENTS || (CHANNEL_EVENTS = {}));
export var TRANSPORTS;
(function (TRANSPORTS) {
    TRANSPORTS["websocket"] = "websocket";
})(TRANSPORTS || (TRANSPORTS = {}));
export var CONNECTION_STATE;
(function (CONNECTION_STATE) {
    CONNECTION_STATE["Connecting"] = "connecting";
    CONNECTION_STATE["Open"] = "open";
    CONNECTION_STATE["Closing"] = "closing";
    CONNECTION_STATE["Closed"] = "closed";
})(CONNECTION_STATE || (CONNECTION_STATE = {}));
`,
    mainConstants: `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONNECTION_STATE = exports.TRANSPORTS = exports.CHANNEL_EVENTS = exports.CHANNEL_STATES = exports.SOCKET_STATES = exports.MAX_PUSH_BUFFER_SIZE = exports.WS_CLOSE_NORMAL = exports.DEFAULT_TIMEOUT = exports.VERSION = exports.DEFAULT_VSN = exports.VSN_2_0_0 = exports.VSN_1_0_0 = exports.DEFAULT_VERSION = void 0;
const version_1 = require("./version");
exports.DEFAULT_VERSION = \`realtime-js/\${version_1.version}\`;
exports.VSN_1_0_0 = '1.0.0';
exports.VSN_2_0_0 = '2.0.0';
exports.DEFAULT_VSN = exports.VSN_1_0_0;
exports.VERSION = version_1.version;
exports.DEFAULT_TIMEOUT = 10000;
exports.WS_CLOSE_NORMAL = 1000;
exports.MAX_PUSH_BUFFER_SIZE = 100;
var SOCKET_STATES;
(function (SOCKET_STATES) {
    SOCKET_STATES[SOCKET_STATES["connecting"] = 0] = "connecting";
    SOCKET_STATES[SOCKET_STATES["open"] = 1] = "open";
    SOCKET_STATES[SOCKET_STATES["closing"] = 2] = "closing";
    SOCKET_STATES[SOCKET_STATES["closed"] = 3] = "closed";
})(SOCKET_STATES || (exports.SOCKET_STATES = SOCKET_STATES = {}));
var CHANNEL_STATES;
(function (CHANNEL_STATES) {
    CHANNEL_STATES["closed"] = "closed";
    CHANNEL_STATES["errored"] = "errored";
    CHANNEL_STATES["joined"] = "joined";
    CHANNEL_STATES["joining"] = "joining";
    CHANNEL_STATES["leaving"] = "leaving";
})(CHANNEL_STATES || (exports.CHANNEL_STATES = CHANNEL_STATES = {}));
var CHANNEL_EVENTS;
(function (CHANNEL_EVENTS) {
    CHANNEL_EVENTS["close"] = "phx_close";
    CHANNEL_EVENTS["error"] = "phx_error";
    CHANNEL_EVENTS["join"] = "phx_join";
    CHANNEL_EVENTS["reply"] = "phx_reply";
    CHANNEL_EVENTS["leave"] = "phx_leave";
    CHANNEL_EVENTS["access_token"] = "access_token";
})(CHANNEL_EVENTS || (exports.CHANNEL_EVENTS = CHANNEL_EVENTS = {}));
var TRANSPORTS;
(function (TRANSPORTS) {
    TRANSPORTS["websocket"] = "websocket";
})(TRANSPORTS || (exports.TRANSPORTS = TRANSPORTS = {}));
var CONNECTION_STATE;
(function (CONNECTION_STATE) {
    CONNECTION_STATE["Connecting"] = "connecting";
    CONNECTION_STATE["Open"] = "open";
    CONNECTION_STATE["Closing"] = "closing";
    CONNECTION_STATE["Closed"] = "closed";
})(CONNECTION_STATE || (exports.CONNECTION_STATE = CONNECTION_STATE = {}));
`,
    moduleVersion: `// Generated automatically during releases by scripts/update-version-files.ts
// This file provides runtime access to the package version for:
// - HTTP request headers (e.g., X-Client-Info header for API requests)
// - Debugging and support (identifying which version is running)
// - Telemetry and logging (version reporting in errors/analytics)
// - Ensuring build artifacts match the published package version
export const version = '${pkgVersion}';
`,
    mainVersion: `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = void 0;
// Generated automatically during releases by scripts/update-version-files.ts
// This file provides runtime access to the package version for:
// - HTTP request headers (e.g., X-Client-Info header for API requests)
// - Debugging and support (identifying which version is running)
// - Telemetry and logging (version reporting in errors/analytics)
// - Ensuring build artifacts match the published package version
exports.version = '${pkgVersion}';
`,
  };

  const writeFile = (filePath, defaultContent) => {
    mkdirSync(dirname(filePath), { recursive: true });
    const content = existsSync(filePath) ? readFileSync(filePath, 'utf8') : defaultContent;
    writeFileSync(filePath, content, 'utf8');
  };

  writeFile(targetFiles.moduleConstants, fallback.moduleConstants);
  writeFile(targetFiles.mainConstants, fallback.mainConstants);
  writeFile(targetFiles.moduleVersion, fallback.moduleVersion);
  writeFile(targetFiles.mainVersion, fallback.mainVersion);
};

const ensureSupabaseJs = () => {
  let pkgJsonPath;
  try {
    pkgJsonPath = require.resolve('@supabase/supabase-js/package.json');
  } catch {
    console.warn('[ensure-supabase-constants] @supabase/supabase-js not installed, skipping.');
    return;
  }

  const pkgDir = dirname(pkgJsonPath);
  const pkgVersion = JSON.parse(readFileSync(pkgJsonPath, 'utf8')).version || '0.0.0';

  const targetFiles = {
    moduleConstants: join(pkgDir, 'dist/module/lib/constants.js'),
    mainConstants: join(pkgDir, 'dist/main/lib/constants.js'),
    moduleVersion: join(pkgDir, 'dist/module/lib/version.js'),
    mainVersion: join(pkgDir, 'dist/main/lib/version.js'),
  };

  const fallback = {
    moduleConstants: `import { version } from './version';
let JS_ENV = '';
// @ts-ignore
if (typeof Deno !== 'undefined') {
    JS_ENV = 'deno';
}
else if (typeof document !== 'undefined') {
    JS_ENV = 'web';
}
else if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    JS_ENV = 'react-native';
}
else {
    JS_ENV = 'node';
}
export const DEFAULT_HEADERS = { 'X-Client-Info': \`supabase-js-\${JS_ENV}/\${version}\` };
export const DEFAULT_GLOBAL_OPTIONS = {
    headers: DEFAULT_HEADERS,
};
export const DEFAULT_DB_OPTIONS = {
    schema: 'public',
};
export const DEFAULT_AUTH_OPTIONS = {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
};
export const DEFAULT_REALTIME_OPTIONS = {};
`,
    mainConstants: `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_REALTIME_OPTIONS = exports.DEFAULT_AUTH_OPTIONS = exports.DEFAULT_DB_OPTIONS = exports.DEFAULT_GLOBAL_OPTIONS = exports.DEFAULT_HEADERS = void 0;
const version_1 = require("./version");
let JS_ENV = '';
// @ts-ignore
if (typeof Deno !== 'undefined') {
    JS_ENV = 'deno';
}
else if (typeof document !== 'undefined') {
    JS_ENV = 'web';
}
else if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    JS_ENV = 'react-native';
}
else {
    JS_ENV = 'node';
}
exports.DEFAULT_HEADERS = { 'X-Client-Info': \`supabase-js-\${JS_ENV}/\${version_1.version}\` };
exports.DEFAULT_GLOBAL_OPTIONS = {
    headers: exports.DEFAULT_HEADERS,
};
exports.DEFAULT_DB_OPTIONS = {
    schema: 'public',
};
exports.DEFAULT_AUTH_OPTIONS = {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
};
exports.DEFAULT_REALTIME_OPTIONS = {};
`,
    moduleVersion: `// Generated automatically during releases by scripts/update-version-files.ts
// This file provides runtime access to the package version for:
// - HTTP request headers (e.g., X-Client-Info header for API requests)
// - Debugging and support (identifying which version is running)
// - Telemetry and logging (version reporting in errors/analytics)
// - Ensuring build artifacts match the published package version
export const version = '${pkgVersion}';
`,
    mainVersion: `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = void 0;
// Generated automatically during releases by scripts/update-version-files.ts
// This file provides runtime access to the package version for:
// - HTTP request headers (e.g., X-Client-Info header for API requests)
// - Debugging and support (identifying which version is running)
// - Telemetry and logging (version reporting in errors/analytics)
// - Ensuring build artifacts match the published package version
exports.version = '${pkgVersion}';
`,
  };

  const writeFile = (filePath, defaultContent) => {
    mkdirSync(dirname(filePath), { recursive: true });
    const content = existsSync(filePath) ? readFileSync(filePath, 'utf8') : defaultContent;
    writeFileSync(filePath, content, 'utf8');
  };

  writeFile(targetFiles.moduleConstants, fallback.moduleConstants);
  writeFile(targetFiles.mainConstants, fallback.mainConstants);
  writeFile(targetFiles.moduleVersion, fallback.moduleVersion);
  writeFile(targetFiles.mainVersion, fallback.mainVersion);
};

ensureRealtime();
ensureSupabaseJs();
