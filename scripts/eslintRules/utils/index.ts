import { ESLintUtils } from "@typescript-eslint/utils";
import type { RuleContext } from "@typescript-eslint/utils/ts-eslint";

export const createRule = ESLintUtils.RuleCreator(() => "");

export const WEBPACK_COMMON = "@webpack/common";

export type DefaultRuleContext = RuleContext<string, unknown[]>;
