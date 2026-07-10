import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
    {
        ignores: [
            "dist/**",
            "node_modules/**",
            "scratch/**",
            "scripts/**",
            "patch_orgchart.js",
            ".puppeteerrc.cjs",
            "public/sw.js",
            "test-local-render.ts",
            "test-professional-tet.ts"
        ],
    },

    js.configs.recommended,

    ...tseslint.configs.recommended,

    {
        files: ["**/*.{ts,tsx,js,jsx}"],

        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },

        plugins: {
            "react-hooks": reactHooks,
            "react-refresh": reactRefresh,
        },

        rules: {
            ...reactHooks.configs.recommended.rules,

            "react-refresh/only-export-components": [
                "warn",
                { allowConstantExport: true },
            ],

            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/no-require-imports": "off",
            "prefer-const": "warn",
            "no-undef": "off",
            "no-useless-escape": "off",
            "react-hooks/set-state-in-effect": "off",
            "react-hooks/immutability": "off"
        },
    },
];