import type { RuleFixer } from "@typescript-eslint/utils/ts-eslint";
import { error } from "./error.ts";
import { n, type t } from "./re.js";
import type { DefaultRuleContext } from "./index.ts";

export function defaultToNamespace(node: t.ImportDefaultSpecifier): string {
    return `* as ${stringify(node.local)}`;
}

export function stringify(node: t.Node): string {
    switch (node.type) {
        case n.Literal:
            return node.value?.toString() ?? "null";
        case n.Identifier:
            return node.name;
        default:
            error(`unhandled node type in stringify: ${node.type}`);
    }
}

export interface RenamedImport {
    imported: string;
    local: string;
}

type Import = string | RenamedImport;

export function addImportFromModule(fixer: RuleFixer, context: DefaultRuleContext, moduleName: string, overwrite: boolean, ...imports: Import[]): void;
export function addImportFromModule(fixer: RuleFixer, context: DefaultRuleContext, moduleName: string, ...imports: Import[]): void;
/**
 * does not check if the variable will collide
 *
 * @param fixer
 * @param context
 * @param moduleName
 * @param overwriteOrFirst
 * @param _imports
 *
 * @see {@link willCollide}
 */
export function addImportFromModule(fixer: RuleFixer, context: DefaultRuleContext, moduleName: string, overwriteOrFirst?: boolean | Import, ..._imports: Import[]): void {
    const overwrite = typeof overwriteOrFirst === "boolean" ? overwriteOrFirst : false;
    const imports = typeof overwriteOrFirst === "boolean" ? _imports : [overwriteOrFirst, ..._imports];
}
