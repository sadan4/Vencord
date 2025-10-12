import type { RuleFix, RuleFixer } from "@typescript-eslint/utils/ts-eslint";
import { error } from "./error.ts";
import { n, t } from "./re.ts";
import { hasTrailingComma, IDENT_REGEX, query, type DefaultRuleContext } from "./index.ts";
import * as posix from "node:path/posix";
import { nonNullish } from "./lambdas.ts";

export function defaultToNamespace(node: t.ImportDefaultSpecifier): string {
    return `* as ${stringify(node.local)}`;
}

type StringifyableNode = t.Literal | t.Identifier;

export function stringify(node: StringifyableNode): string {
    switch (node.type) {
        case n.Literal:
            return node.value?.toString() ?? "null";
        case n.Identifier:
            return node.name;
    }
}

export interface RenamedImport {
    imported: string;
    local: string;
}

type Import = string | RenamedImport;

/**
 * hack for jsdoc
 */
type _SCOPE_TS = typeof import("./scope.ts");
/**
 * does not check if the variable will collide
 *
 * @param fixer
 * @param context
 * @param moduleName
 * @param overwrite
 * @param imports
 *
 * @see {@link _SCOPE_TS.willCollide|willCollide}
 */
export function addImportFromModule(fixer: RuleFixer, context: DefaultRuleContext, moduleName: string, overwrite: boolean, ...imports: Import[]): RuleFix[];
/**
 * does not check if the variable will collide
 *
 * @param fixer
 * @param context
 * @param moduleName
 * @param imports
 *
 * @see {@link _SCOPE_TS.willCollide|willCollide}
 */
export function addImportFromModule(fixer: RuleFixer, context: DefaultRuleContext, moduleName: string, ...imports: Import[]): RuleFix[];
export function addImportFromModule(fixer: RuleFixer, context: DefaultRuleContext, _moduleName: string, overwriteOrFirst?: boolean | Import, ..._imports: Import[]): RuleFix[] {
    const overwrite = typeof overwriteOrFirst === "boolean" ? overwriteOrFirst : false;
    const imports = (typeof overwriteOrFirst === "boolean" ? _imports : [overwriteOrFirst, ..._imports])
        // don't think this filter is needed
        .filter(nonNullish)
        .map((i) => {
            if (typeof i === "string") {
                return i;
            }
            let { imported, local } = i;
            // if it's not a valid js ident, we need to quote it
            if (!IDENT_REGEX.test(imported)) {
                imported = JSON.stringify(imported);
            }
            return `${imported} as ${local}`;
        })
        .join(", ");

    if (imports.length === 0) {
        error("no imports provided");
    }

    // normalize can't remove `../`
    let moduleName = _moduleName.startsWith("./") ? `./${posix.normalize(_moduleName)}` : posix.normalize(_moduleName);
    const fixes: RuleFix[] = [];
    const [selected] = query<t.ImportDeclaration | undefined>(
        context.sourceCode.ast,
        // a non-type import with the same value as what we are trying to import from and already has named imports
        `ImportDeclaration[importKind!=type][source.value=${JSON.stringify(moduleName)}]:has(>ImportSpecifier)`
    );
    if (selected) {
        let toAppend = imports;
        if (!hasTrailingComma(context, selected)) {
            toAppend = `, ${toAppend}`;
        }
        fixes.push(fixer.insertTextAfter(selected.specifiers.at(-1)!, toAppend));
    } else {
        fixes.push(
            fixer.insertTextBeforeRange(
                query(context.sourceCode.ast, "ImportDeclaration").at(0)?.range ?? [0, 0],
                `import { ${imports} } from "${moduleName}";\n`,
            ),
        );
    }
    return fixes;
}
