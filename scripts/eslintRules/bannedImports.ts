import { getParserServices } from "@typescript-eslint/utils/eslint-utils";
import { assert, error, todo, unreachable } from "./utils/error.ts";
import { createRule, WEBPACK_COMMON } from "./utils/index.ts";
import type { t } from "./utils/re.js";
import { addImportFromModule, defaultToNamespace, stringify } from "./utils/transform.ts";
import { resolveModuleName } from "typescript";
import { createResolveModuleName } from "./utils/ts.ts";
import { getVarEntry, isUsedAsValue } from "./utils/scope.ts";
import type { RuleFix } from "@typescript-eslint/utils/ts-eslint";


interface BannedImport {
    moduleName: RegExp;
    flaggedExports: string[] | "all" | "non-type";
}

const bannedImports: readonly BannedImport[] = Object.freeze([
    {
        moduleName: /^react(-dom)?$/,
        flaggedExports: "non-type"
    }
] satisfies BannedImport[]);

export default createRule({
    name: "banned-imports",
    create(context) {
        let cur: BannedImport | undefined = undefined;
        let curNode: t.ImportDeclaration | undefined = undefined;
        const resolveModuleName = createResolveModuleName(context);
        const service = getParserServices(context);
        return {
            "ImportDeclaration"(node) {
                if (node.importKind === "type") {
                    return;
                }
                curNode = node;
                cur = bannedImports.find(({ moduleName }) => moduleName.test(node.source.value));
                if (!node.specifiers.length && cur) {
                    reportSideEffectImport(node);
                }
            },
            "ImportDeclaration:exit"(node) {
                cur = undefined;
                curNode = undefined;
            },
            "ImportSpecifier"(node) {
                if (isBannedImport(node)) {
                    if (isAvailableFromWebpackCommon(stringify(node.imported))) {
                        reportMovableImport(node, WEBPACK_COMMON);
                    } else {
                        reportBannedImport(node);
                    }
                }
            },
            "ImportDefaultSpecifier"(node) {
                if (cur) {
                    reportDefaultImport(node);
                }
            }
        };

        function reportSideEffectImport(node: t.ImportDeclaration) {
            context.report({
                messageId: "bannedSideEffectImport",
                data: {
                    "moduleName": node.source.value
                },
                node,
                fix(fixer) {
                    return fixer.remove(node);
                }
            });
        }

        function reportDefaultImport(node: t.ImportDefaultSpecifier) {
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

        function reportBannedImport(node: t.ImportSpecifier, opts?: Omit<Parameters<typeof context["report"]>[0], "data" | "messageId" | "node">) {
            const i = cur;
            assert(i);
            assert(curNode);
            context.report({
                node,
                messageId: "bannedImport",
                data: {
                    importName: stringify(node.imported),
                    moduleName: stringify(curNode.source)
                },
                ...opts
            });
        }

        function reportMovableImport(node: t.ImportSpecifier, newModuleName: string) {
            const i = cur;
            assert(i);
            assert(curNode);
            const importName = stringify(node.imported);

            reportBannedImport(node, {
                suggest: [
                    {
                        messageId: "suggestChangeBannedImportSource",
                        data: {
                            importName,
                            newModuleName,
                        },
                        *fix(fixer): IterableIterator<RuleFix> {
                            yield* addImportFromModule(fixer, context, newModuleName, true);
                        }
                    }
                ]
            });
        }

        function isBannedImport(node: t.ImportSpecifier): boolean {
            if (!cur)
                return false;
            if (node.importKind === "type")
                return false;
            if (cur.flaggedExports === "all")
                return true;
            if (cur.flaggedExports === "non-type") {
                const ident = node.local;
                // imported so it has to have a var entry
                const varEntry = getVarEntry(context, ident) ?? unreachable();
                return varEntry.references.length !== 0 && isUsedAsValue(varEntry);
            }
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
            bannedImport: 'Importing "{{importName}}" from "{{moduleName}}" is banned and will error at runtime.',
            suggestChangeBannedImportSource: 'Update import "{{importName}}" to be from "{{newModuleName}}".',
            suggestRemoveBannedImport: 'Remove import "{{importName}}" from "{{moduleName}}".',
            bannedSideEffectImport: 'Importing "{{moduleName}}" for side effects is banned and will do nothing.',
            bannedDefaultImport: 'Default import from "{{moduleName}}" is banned. For types, please use named or namespace imports instead.',
            suggestBannedDefaultImport: 'Replace default import from "{{moduleName}}" with a namespace import.'
        }
    },
    defaultOptions: []
});
