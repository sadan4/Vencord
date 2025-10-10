import type { t } from "./re.ts";

export function isDefaultImportSpecifier(node: t.BaseNode): node is t.ImportDefaultSpecifier {
    return node.type === "ImportDefaultSpecifier";
}
