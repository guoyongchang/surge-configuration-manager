import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import enSubscriptions from "./locales/en/subscriptions.json";
import enRules from "./locales/en/rules.json";
import enExtraNodes from "./locales/en/extraNodes.json";
import enOutput from "./locales/en/output.json";
import enSettings from "./locales/en/settings.json";

import zhCommon from "./locales/zh/common.json";
import zhSubscriptions from "./locales/zh/subscriptions.json";
import zhRules from "./locales/zh/rules.json";
import zhExtraNodes from "./locales/zh/extraNodes.json";
import zhOutput from "./locales/zh/output.json";
import zhSettings from "./locales/zh/settings.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        subscriptions: enSubscriptions,
        rules: enRules,
        extraNodes: enExtraNodes,
        output: enOutput,
        settings: enSettings,
      },
      zh: {
        common: zhCommon,
        subscriptions: zhSubscriptions,
        rules: zhRules,
        extraNodes: zhExtraNodes,
        output: zhOutput,
        settings: zhSettings,
      },
    },
    fallbackLng: "en",
    defaultNS: "common",
    detection: {
      order: ["localStorage"],
      caches: ["localStorage"],
      lookupLocalStorage: "scm_language",
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
