import type { Scope } from "@typescript-eslint/utils/ts-eslint";
import { isTypeReference } from "./lambdas.ts";
import type { t } from "./re.ts";
import type { DefaultRuleContext } from "./index.ts";
import { error, unreachable } from "./error.ts";

/**
 * does not handle `var` declarations
 */
export function willCollide(scope: Scope.Scope, name: string): Scope.Variable[] | 0 {
    const collisions = scope.variables.filter(v => v.name === name);
    return collisions.length && collisions;
}

export function isUsedAsType(variable: Scope.Variable) {
    return !isUsedAsValue(variable);
}

export function isUsedAsValue(variable: Scope.Variable) {
    return !variable.references.every(({ identifier: { parent } }) => isTypeReference(parent));
}

export function isUsedAsTypeOrValue(variable: Scope.Variable) {
    return !(isUsedAsValue(variable) && isUsedAsType(variable));
}

function isUseOf(variable: Scope.Variable, ident: t.Identifier) {
    return variable.references.some(({ identifier }) => ident === identifier);
}

/**
 * get a variable entry from a use of a variable
 *
 * @returns undefined if the variable was not defined
 */
export function getVarEntry(context: DefaultRuleContext, ident: t.Identifier): Scope.Variable | undefined {
    const scope = context.sourceCode.getScope(ident);
    return scope.variables.find(({ defs }) => defs.some(({ name }) => name === ident));

}
