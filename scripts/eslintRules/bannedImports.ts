import { createRule } from "./utils/index.ts";
import { TSESTree as t } from "@typescript-eslint/utils";


interface BannedImport {
    moduleName: RegExp;
    flaggedExports: string[] | "all" | "non-type";
}

const bannedImports: readonly BannedImport[] = Object.freeze([
    {
        moduleName: /^react(-dom)?$/,
        flaggedExports: "all"
    }
] satisfies BannedImport[]);

export default createRule({
    name: "banned-imports",
    create(context) {
        return {
            "ImportDeclaration[specifiers.length=0]"(node: t.ImportDeclaration) {
                if (bannedImports.some(({ moduleName }) => moduleName.test(node.source.value))) {
                    context.report({
                        messageId: "bannedSideEffectImport",
                        data: {
                            "moduleSource": node.source.value
                        },
                        node,
                        fix(fixer) {
                            return fixer.remove(node);
                        }
                    });
                }
            },
            "ImportDeclaration:has(ImportDefaultSpecifier)"(node: t.ImportDeclaration) {
                if (bannedImports.some(({ moduleName }) => moduleName.test(node.source.value))) {
                    context.report({
                        messageId: "bannedDefaultImport",
                        data: {
                            "moduleName": node.source.value
                        },
                        node
                        // TODO: add simple inline fixer
                    });
                }
            }
        };
    },
    meta: {
        fixable: "code",
        docs: {
            description: "Ban imports that are provided at runtime."
        },
        type: "problem",
        "schema": [],
        messages: {
            bannedImport: 'Importing "{{importName}}" from "{{moduleName}}" is banned. Please import it from "@webpack/common" instead.',
            bannedSideEffectImport: 'Importing "{{moduleSource}}" for side effects is banned and will do nothing.',
            bannedDefaultImport: 'Default import from "{{moduleName}}" is banned. For types, please use named imports instead.'
        }
    },
    defaultOptions: []
});
