import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  // Next.js + TypeScript temel kurallar
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // API ve lib: 'any' serbest, ts-comment kuralı esnetildi
  {
    files: ["src/app/api/**/*.ts", "src/lib/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          // ts-ignore kullanımı engellenmesin (derlemeyi bloklamasın)
          "ts-ignore": "off",
          // ts-expect-error açıklama ile serbest (daha güvenli kullanım)
          "ts-expect-error": "allow-with-description",
        },
      ],
    },
  },

  // UI (tsx/ts): 'any' sadece uyarı (build'i bloklamasın)
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // Lint dışı bırakılacaklar
  {
    ignores: ["node_modules", ".next", "dist"],
  },
];
