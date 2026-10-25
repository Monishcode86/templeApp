const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const apiDir = path.join(rootDir, 'api');
const targetStagingDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(rootDir, 'staging', 'api');

if (!fs.existsSync(targetStagingDir)) {
    fs.mkdirSync(targetStagingDir, { recursive: true });
}

console.log('[build_sea] Preparing self-contained Node 24 Single Executable Application...');
console.log(`[build_sea] Source: "${apiDir}"`);
console.log(`[build_sea] Staging: "${targetStagingDir}"`);

// 1. Locate prebuilt win32-x64 bcrypt.node
const bcryptNodePath = path.join(apiDir, 'node_modules', 'bcrypt', 'prebuilds', 'win32-x64', 'bcrypt.node');
if (!fs.existsSync(bcryptNodePath)) {
    console.error(`[build_sea ERROR] Prebuilt bcrypt native addon missing at: "${bcryptNodePath}"`);
    process.exit(1);
}

const bcryptBuf = fs.readFileSync(bcryptNodePath);
const bcryptB64 = bcryptBuf.toString('base64');

// 2. Generate node-gyp-build shim that extracts bcrypt.node to %TEMP% on demand and dlopens it
const shimPath = path.join(targetStagingDir, 'node-gyp-build-shim.js');
const shimContent = `
const fs = require('fs');
const path = require('path');
const os = require('os');

const BCRYPT_B64 = "${bcryptB64}";
let cachedBinding = null;

function loadBcrypt() {
    if (cachedBinding) return cachedBinding;
    const tmpFile = path.join(os.tmpdir(), 'templeapp_bcrypt_v6.node');
    try {
        if (!fs.existsSync(tmpFile) || fs.statSync(tmpFile).size === 0) {
            fs.writeFileSync(tmpFile, Buffer.from(BCRYPT_B64, 'base64'));
        }
    } catch (e) {
        // Fallback with pid if file is currently locked by another instance
        const fallbackTmp = path.join(os.tmpdir(), 'templeapp_bcrypt_' + process.pid + '.node');
        if (!fs.existsSync(fallbackTmp)) {
            fs.writeFileSync(fallbackTmp, Buffer.from(BCRYPT_B64, 'base64'));
        }
        const mod = { exports: {} };
        process.dlopen(mod, fallbackTmp);
        cachedBinding = mod.exports;
        return cachedBinding;
    }
    const mod = { exports: {} };
    process.dlopen(mod, tmpFile);
    cachedBinding = mod.exports;
    return cachedBinding;
}

module.exports = function(dir) {
    return loadBcrypt();
};
`;

fs.writeFileSync(shimPath, shimContent);
console.log('[build_sea] Generated native addon loader shim.');

// 3. Read environment configuration to compile directly into the executable (no plaintext .env on disk)
let embeddedEnv = {};
const envFilePath = path.join(apiDir, '.env');
if (fs.existsSync(envFilePath)) {
    const envLines = fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/);
    for (const line of envLines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
            embeddedEnv[key] = val;
        }
    }
}
embeddedEnv.NODE_ENV = 'production';
console.log(`[build_sea] Embedded ${Object.keys(embeddedEnv).length} configuration variables securely into executable binary.`);

// Generate entry wrapper that initializes process.env from embedded configuration
const entryWrapperPath = path.join(targetStagingDir, 'entry-wrapper.js');
const entryWrapperContent = `
const __embeddedEnv = ${JSON.stringify(embeddedEnv, null, 2)};
for (const [k, v] of Object.entries(__embeddedEnv)) {
    if (!process.env[k]) {
        process.env[k] = v;
    }
}
require(${JSON.stringify(path.join(apiDir, 'index.js'))});
`;
fs.writeFileSync(entryWrapperPath, entryWrapperContent);

// 4. Bundle application with esbuild into sea-entry.js
const entryJsPath = path.join(targetStagingDir, 'sea-entry.js');
console.log('[build_sea] Bundling JavaScript application with esbuild...');

const esbuildCmd = `npx -y esbuild "${entryWrapperPath.replace(/\\/g, '/')}" --bundle --platform=node --target=node24 "--alias:node-gyp-build=${shimPath.replace(/\\/g, '/')}" "--outfile=${entryJsPath.replace(/\\/g, '/')}"`;

execSync(esbuildCmd, { cwd: rootDir, stdio: 'inherit' });

if (!fs.existsSync(entryJsPath)) {
    console.error('[build_sea ERROR] Bundled sea-entry.js was not created.');
    process.exit(1);
}

// 4. Generate sea-config.json
const seaConfig = {
    main: 'sea-entry.js',
    output: 'sea-prep.blob'
};
fs.writeFileSync(path.join(targetStagingDir, 'sea-config.json'), JSON.stringify(seaConfig, null, 2));

// 5. Compile SEA preparation blob
console.log('[build_sea] Compiling SEA preparation blob with Node.js...');
execSync('node --experimental-sea-config sea-config.json', { cwd: targetStagingDir, stdio: 'inherit' });

const blobPath = path.join(targetStagingDir, 'sea-prep.blob');
if (!fs.existsSync(blobPath)) {
    console.error('[build_sea ERROR] sea-prep.blob generation failed.');
    process.exit(1);
}

console.log('[build_sea SUCCESS] Self-contained SEA preparation blob ready.');
