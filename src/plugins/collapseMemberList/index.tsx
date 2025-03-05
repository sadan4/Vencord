/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { useCallback } from "@webpack/common";

import { ICollapsedSectionStore, useCollapsedSectionsStore } from "./CollapsedSectionsStore";



type Row = {
    type: "MEMBER";
    hoistRoleId: string;
};
type Group = {
    type: "GROUP";
    count: number;
    index: number;
    /**
     * Role ID
     */
    id: string;
    key: string;
    title: string;
};

type MemberStoreProps = {
    groups: Group[];
    rows: Row[];
};

function fixupIndices(store: MemberStoreProps) {
    for (let i = 1; i < store.groups.length; i++) {
        store.groups[i].index = store.groups[i - 1].index + store.groups[i - 1].count + 1;
    }
}

function removeGroup(store: MemberStoreProps, entryIndex: number, keepHeader = true) {
    if (entryIndex >= store.groups.length) return;
    let count, index;
    if (keepHeader) {
        count = store.groups[entryIndex].count;
        store.groups[entryIndex].count = 0;
        index = store.groups[entryIndex].index;
    } else {
        [{ count, index }] = store.groups.splice(entryIndex, 1);
    }
    store.rows.splice(index + +keepHeader, count);
    for (let i = entryIndex + +keepHeader; i < store.groups.length; i++) {
        store.groups[i].index -= count;
    }
}

export default definePlugin({
    name: "CollapseMemberList",
    description: "",
    authors: [Devs.sadan],

    patches: [
        {
            find: 'key:"section-"',
            group: true,
            replacement: [
                {
                    match: /let.{0,200}keyboardModeEnabled/,
                    replace: "vc_sections_store = $self.useCollapsedSectionsStore();$&"
                },
                {
                    match: /\i\.\i\.getProps\((\i\.guild_id),\i\.id\)/,
                    replace: "$self.wrapMemberStore($1, vc_sections_store)($&),[vc_sections_store]"
                },
                {
                    match: /(\(0,\i\.jsxs?\)\(\i\.\i,.{0,100}membersGroup,children:\[.*?\)\]\}\))/,
                    replace: "$self.wrapSectionHeader(arguments[0], $1)"
                }
            ]
        }
    ],

    useCollapsedSectionsStore,
    wrapSectionHeader({ id, guildId }, children) {
        const store = useCollapsedSectionsStore();
        const divCB = useCallback(() => {
            store.toggleCollapsed(guildId, id);
        }, [id, guildId, store]);
        return <div
            onClick={divCB}
        >
            {children}
        </div>;
    },

    wrapMemberStore: (guildId: string, s: ICollapsedSectionStore) => function (store: MemberStoreProps): MemberStoreProps {
        if (!guildId)
            return console.log("guildId is not null"), store;
        store.rows = [...store.rows];
        store.groups = store.groups.map(x => ({ ...x }));
        for (let i = 0; i < store.groups.length; i++)
            if (s.isCollapsed(guildId, store.groups[i].id)) {
                console.log("removing group");
                removeGroup(store, i);
            }
        return store;
    }
});
