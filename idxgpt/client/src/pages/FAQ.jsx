import React from "react";
import { useTranslation } from "react-i18next";

export default function FAQ() {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-4">{t("footerPages.faq.title")}</h1>
      <p className="text-gray-700">
        {t("footerPages.faq.content")}
      </p>
    </div>
  );
}