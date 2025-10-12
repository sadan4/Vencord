import { n, type t } from "./re.ts";

export function isDefaultImportSpecifier(node: t.Node): node is t.ImportDefaultSpecifier {
    return node.type === n.ImportDefaultSpecifier;
}

export function isTypeReference(node: t.Node): node is t.TSTypeReference {
    return node.type === n.TSTypeReference;
}

export function nonNullish<T>(e: T): e is Exclude<T, undefined | null> {
    return e != null;
}
