import { getParserServices } from "@typescript-eslint/utils/eslint-utils";
import {
    resolveModuleName,
    sys,
    type ResolvedModuleFull,
} from "typescript";
import type { DefaultRuleContext } from "./index.ts";

type ResolveModuleName = (name: string) => ResolvedModuleFull | undefined;


export function createResolveModuleName(context: DefaultRuleContext): ResolveModuleName {
    const program = getParserServices(context).program;
    return (name: string) => resolveModuleName(
        name,
        context.physicalFilename,
        program.getCompilerOptions(),
        sys,
    ).resolvedModule;
}
