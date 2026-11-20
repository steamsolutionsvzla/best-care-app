/**
 * scripts/patch-android-proguard.js
 *
 * Corrige un problema de compatibilidad entre AGP (Android Gradle Plugin)
 * reciente y los plugins de Capacitor/Cordova instalados en node_modules.
 *
 * Muchos plugins nativos traen en su `android/build.gradle` la línea:
 *   proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
 *
 * AGP moderno (>= 8.x/9.x) ya no permite 'proguard-android.txt' porque incluye
 * `-dontoptimize`. Hay que usar 'proguard-android-optimize.txt' en su lugar.
 *
 * Como node_modules se reinstala/reescribe con cada `npm install`, este script
 * se ejecuta automáticamente vía el hook "postinstall" de package.json para
 * que el fix se vuelva a aplicar siempre, sin intervención manual.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NODE_MODULES = path.join(ROOT, 'node_modules');

const OLD = "getDefaultProguardFile('proguard-android.txt')";
const NEW = "getDefaultProguardFile('proguard-android-optimize.txt')";

let patchedCount = 0;

/** Busca recursivamente todos los archivos android/build.gradle dentro de node_modules */
function findBuildGradleFiles(dir, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    // Optimización: solo bajamos a carpetas "android" o paquetes de primer/segundo nivel
    if (entry.isDirectory()) {
      const fullPath = path.join(dir, entry.name);
      if (entry.name === 'android') {
        const buildGradle = path.join(fullPath, 'build.gradle');
        if (fs.existsSync(buildGradle)) {
          results.push(buildGradle);
        }
      } else if (!entry.name.startsWith('.')) {
        findBuildGradleFiles(fullPath, results);
      }
    }
  }
  return results;
}

function patchFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(OLD)) {
    const patched = content.split(OLD).join(NEW);
    fs.writeFileSync(filePath, patched, 'utf8');
    patchedCount++;
    console.log(`  ✔ Parchado: ${path.relative(ROOT, filePath)}`);
  }
}

if (!fs.existsSync(NODE_MODULES)) {
  console.log('[patch-android-proguard] node_modules no encontrado, se omite.');
  process.exit(0);
}

console.log('[patch-android-proguard] Buscando plugins Android con proguard-android.txt obsoleto...');

const candidates = findBuildGradleFiles(NODE_MODULES);
candidates.forEach(patchFile);

if (patchedCount === 0) {
  console.log('[patch-android-proguard] Nada que parchar. Todo en orden.');
} else {
  console.log(`[patch-android-proguard] Listo. ${patchedCount} archivo(s) corregido(s).`);
}
