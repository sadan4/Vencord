import { getParserServices } from "@typescript-eslint/utils/eslint-utils";
import { error, todo } from "./utils/error.ts";
import { createRule, WEBPACK_COMMON } from "./utils/index.ts";
import type { t } from "./utils/re.js";
import { defaultToNamespace, stringify } from "./utils/transform.ts";
import { resolveModuleName } from "typescript";
import { createResolveModuleName } from "./utils/ts.ts";


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
        let cur: BannedImport | undefined = undefined;
        const resolveModuleName = createResolveModuleName(context);
        const service = getParserServices(context);
        return {
            "ImportDeclaration"(node) {
                cur = bannedImports.find(({ moduleName }) => moduleName.test(node.source.value));
                if (!node.specifiers.length && cur) {
                    reportSideEffectImport(node);
                }
            },
            "ImportDeclaration:exit"(node) {
                cur = undefined;
            },
            "ImportSpecifier"(node) {
                if (isBannedImport(node)) {

                }
            },
            "ImportDefaultSpecifier"(node: t.ImportDefaultSpecifier) {
                if (cur) {
                    context.report({
                        messageId: "bannedDefaultImport",
                        data: {
                            "moduleName": node.local.name
                        },
                        node,
                        suggest: [
                            {
                                messageId: "suggestBannedDefaultImport",
                                data: {
                                    "moduleName": node.local.name
                                },
                                fix(fixer) {
                                    return fixer.replaceText(node, defaultToNamespace(node));
                                }
                            }
                        ]
                    });
                }
            }
        };

        function reportSideEffectImport(node: t.ImportDeclaration) {
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

        function isBannedImport(node: t.ImportSpecifier): boolean {
            if (!cur)
                return false;
            if (cur.flaggedExports === "all")
                return true;
            if (cur.flaggedExports === "non-type")
                todo();
            return cur.flaggedExports.includes(stringify(node.imported));
        }

        function isAvailableFromWebpackCommon(name: string): boolean {
            const wpCommon = resolveModuleName(WEBPACK_COMMON);

            if (!wpCommon)
                error(`could not resolve module ${WEBPACK_COMMON}`);

            const sf = service.program.getSourceFile(wpCommon.resolvedFileName);

            if (!sf)
                error(`could not find source file for ${WEBPACK_COMMON}`);

            const moduleSymbol = service.program.getTypeChecker().getSymbolAtLocation(sf);

            if (!moduleSymbol)
                error(`could not get module symbol for ${WEBPACK_COMMON}`);

            return service
                .program
                .getTypeChecker()
                .getExportsOfModule(moduleSymbol)
                .some(sym => {
                    return sym.name === name;
                });
        }
    },
    meta: {
        fixable: "code",
        hasSuggestions: true,
        docs: {
            description: "Ban imports that are provided at runtime."
        },
        type: "problem",
        "schema": [],
        messages: {
            bannedImport: 'Importing "{{importName}}" from "{{moduleName}}" is banned. Please import it from "@webpack/common" instead.',
            bannedSideEffectImport: 'Importing "{{moduleSource}}" for side effects is banned and will do nothing.',
            bannedDefaultImport: 'Default import from "{{moduleName}}" is banned. For types, please use named or namespace imports instead.',
            suggestBannedDefaultImport: 'Replace default import from "{{moduleName}}" with a namespace import.'
        }
    },
    defaultOptions: []
});
