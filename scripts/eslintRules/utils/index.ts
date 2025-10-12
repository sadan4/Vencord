import { ESLintUtils } from "@typescript-eslint/utils";
import type { RuleContext } from "@typescript-eslint/utils/ts-eslint";
import { n, type t } from "./re.ts";
import esquery from "esquery";
import { unreachable } from "./error.ts";

export const createRule = ESLintUtils.RuleCreator(() => "");

export const WEBPACK_COMMON = "@webpack/common";

export type DefaultRuleContext = RuleContext<string, unknown[]>;

export type AssertedType<
    T extends Function,
    E = any,
>
    = T extends (a: any) => a is infer R ? R extends E ? R : never : never;

export type CBAssertion<U = undefined, N = never> = <
    F extends (n: t.Node) => n is t.Node,
    R extends t.Node = AssertedType<F, t.Node>,
>(
    node: t.Node | N,
    func: F extends (n: t.Node) => n is R ? F : never
) => R | U;

/**
 * first parent
 */
export const findParent: CBAssertion<undefined, undefined> = (node, func) => {
    if (!node)
        return undefined;
    while (!func(node)) {
        if (!node.parent)
            return undefined;
        node = node.parent;
    }
    return node;
};

export function query<T extends t.Node | undefined | null = t.Node>(node: t.Node, selector: string): T[] {
    // not typed for typescript-eslint
    return esquery(node as any, selector) as T[];
}

export const IDENT_REGEX = /[A-Za-z$_][\w$]*/;

export type TrailingCommaTarget = t.ImportDeclaration;

export function hasTrailingComma(context: DefaultRuleContext, node: TrailingCommaTarget): boolean {
    switch (node.type) {
        case n.ImportDeclaration: {
            // no named imports -> can't have any commas
            if (!node.specifiers.length) return false;
            return (context.sourceCode.getTokenAfter(node.specifiers.at(-1)!, {
                filter(n) {
                    return n.value === "," || n.value === "}";
                }
            }) ?? unreachable()).value === ",";
        }
    }
}
