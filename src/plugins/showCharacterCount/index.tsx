/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Text, UserStore } from "@webpack/common";

const characterCountClass = findByPropsLazy("characterCount");


export default definePlugin({
    patches: [
        {
            find: ".CHARACTER_COUNT_OVER_LIMIT",
            replacement: [
                {
                    match: /let/,
                    replace:
                        "return $self.CharacterCountComponent(arguments[0]);$&",
                }
            ],
        },
    ],
    name: "ShowCharacterCount",
    authors: [
        {
            name: "sadan",
            id: 521819891141967883n,
        }, {
            name: "iamme",
            id: 984392761929256980n,
        }
    ],
    description: "Show your character count while typing.",
    CharacterCountComponent({ textValue, className }: {
        textValue: string;
        className?: string;
    }): JSX.Element {
        return (
            <Text variant="heading-sm/bold" className={[className, characterCountClass.characterCount, "vc-scc-character-count"].join(" ")} style={{ color: (UserStore.getCurrentUser().premiumType ? 4000 : 2000) < textValue.length ? "red" : void 0 }}>
                {textValue.length}
            </Text>
        );
    },
});