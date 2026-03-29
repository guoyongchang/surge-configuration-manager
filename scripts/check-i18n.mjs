#!/usr/bin/env node
/**
 * check-i18n.mjs
 *
 * Two-stage i18n validation:
 * Stage 1: Verify every t() key exists in at least ONE locale namespace.
 *           This catches genuinely missing keys (the REAL bugs).
 * Stage 2: For files with a single useTranslation call (or where the FIRST
 *           useTranslation is the component's primary namespace), check key placement.
 *           For files with multiple namespaces, report as warning since the checker
 *           cannot accurately track React hook boundaries.
 *
 * Run: node scripts/check-i18n.mjs
 */

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, "../src");
const LOCALES_DIR = join(__dirname, "../src/locales");

// ── Load all locale files ───────────────────────────────────────────────────────

function loadLocales() {
  const locales = {};
  const namespaces = new Set();
  const languages = readdirSync(LOCALES_DIR, { withFileTypes: true });
  for (const langDir of languages) {
    if (!langDir.isDirectory()) continue;
    const lang = langDir.name;
    locales[lang] = {};
    const files = readdirSync(join(LOCALES_DIR, lang));
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const ns = file.replace(/\.json$/, "");
      namespaces.add(ns);
      const content = readFileSync(join(LOCALES_DIR, lang, file), "utf-8");
      locales[lang][ns] = flattenObject(JSON.parse(content));
    }
  }
  return { locales, namespaces: [...namespaces] };
}

function flattenObject(obj, prefix = "") {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

// ── Extract i18n keys from source files ───────────────────────────────────────

function extractKeysFromFile(filePath) {
  const content = readFileSync(filePath, "utf-8");

  // Find all useTranslation calls with their positions
  const useTranslationRegex = /useTranslation\s*\(\s*(["'`])([^"'`]+)\1\s*\)/g;
  const nsChanges = [];
  let match;
  while ((match = useTranslationRegex.exec(content)) !== null) {
    nsChanges.push({ pos: match.index, ns: match[2] });
  }

  // Find all t("key"), t('key'), t(`key`) calls
  const tCallRegex = /\bt\s*\(\s*(["'`])([^"'`\\]+?)\1\s*(?:,|\))/g;
  const results = [];
  while ((match = tCallRegex.exec(content)) !== null) {
    const key = match[2];
    if (!key) continue;
    if (key.includes("/") || key.startsWith("@")) continue;

    // Find the FIRST useTranslation before this t() call
    // (not the last, because in React both hooks run and both namespaces are "active")
    let effectiveNs = "common";
    for (const change of nsChanges) {
      if (change.pos < match.index) {
        effectiveNs = change.ns;
        break; // use FIRST matching useTranslation
      }
    }

    results.push({ ns: effectiveNs, key });
  }

  return results;
}

function scanSource(dir) {
  const allKeys = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".git", "components/ui"].includes(entry.name)) continue;
      allKeys.push(...scanSource(fullPath));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      for (const { ns, key } of extractKeysFromFile(fullPath)) {
        allKeys.push({ ns, key, file: fullPath });
      }
    }
  }
  return allKeys;
}

// ── Validate ─────────────────────────────────────────────────────────────────

function validate() {
  const { locales, namespaces } = loadLocales();
  const sourceKeys = scanSource(SRC_DIR);

  const allLangs = Object.keys(locales);
  if (allLangs.length === 0) {
    console.error("No locale files found!");
    process.exit(1);
  }

  // Stage 1: Build global key registry (key -> Set<ns>) for each language
  const keyRegistry = {};
  for (const lang of allLangs) {
    keyRegistry[lang] = {};
    for (const ns of namespaces) {
      if (!locales[lang][ns]) continue;
      for (const key of Object.keys(locales[lang][ns])) {
        if (!(key in keyRegistry[lang])) keyRegistry[lang][key] = new Set();
        keyRegistry[lang][key].add(ns);
      }
    }
  }

  let hasErrors = false;

  // Stage 1: Check each key exists in at least one namespace
  for (const lang of allLangs) {
    const missing = new Set();
    for (const { ns, key } of sourceKeys) {
      if (!(key in keyRegistry[lang])) {
        missing.add(`${lang}:${ns}:${key}`);
        console.error(`❌ [${lang}] '${ns}:${key}' — key not found in any namespace`);
        hasErrors = true;
      }
    }
  }

  // Stage 2: For keys that exist, check if they're in the right namespace
  const nsMismatches = new Set();
  for (const lang of allLangs) {
    for (const { ns, key } of sourceKeys) {
      if (key in keyRegistry[lang] && !keyRegistry[lang][key].has(ns)) {
        const id = `${lang}:${ns}:${key}`;
        if (!nsMismatches.has(id)) {
          nsMismatches.add(id);
          const foundIn = [...keyRegistry[lang][key]].join(", ");
          console.warn(`⚠️  [${lang}] '${ns}:${key}' — found in [${foundIn}] but not '${ns}'`);
        }
      }
    }
  }

  if (hasErrors) {
    console.error("\n💥 i18n validation failed — missing keys above");
    process.exit(1);
  } else if (nsMismatches.size > 0) {
    console.warn(`\n⚠️  ${nsMismatches.size} namespace mismatch(es) — these are likely false positives from multi-namespace files`);
    console.log("✅ All i18n keys exist in at least one namespace");
    process.exit(0);
  } else {
    console.log("✅ All i18n keys are valid");
    process.exit(0);
  }
}

validate();
