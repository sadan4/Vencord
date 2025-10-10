import type { Scope } from "@typescript-eslint/utils/ts-eslint";

/**
 * does not handle `var` declarations
 */
export function willCollide(scope: Scope.Scope, name: string): Scope.Variable[] | 0 {
    const collisions = scope.variables.filter(v => v.name === name);
    return collisions.length && collisions;
}
