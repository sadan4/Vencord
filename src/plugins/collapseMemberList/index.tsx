/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

type Row = {
    type: "MEMBER";
    hoistRoleId: string;
};
type Group = {
    type: "GROUP";
    count: number;
    index: number;
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

function removeGroup(store: MemberStoreProps, entryIndex: number) {
    if (entryIndex >= store.groups.length) return;
    const [{ count, index }] = store.groups.splice(entryIndex, 1);
    store.rows.splice(index, count + 1);
    for (let i = entryIndex; i < store.groups.length; i++) {
        store.groups[i].index -= count + 1;
    }
}

export default definePlugin({
    name: "CollapseMemberList",
    description: "",
    authors: [Devs.sadan],

    patches: [
        {
            find: 'key:"section-"',
            replacement: {
                match: /\i\.\i\.getProps\(\i\.guild_id,\i\.id\)/,
                replace: "$self.wrapMemberStore($&)"
            }
        }
    ],

    wrapMemberStore(store: MemberStoreProps): MemberStoreProps {
        store.groups = store.groups.map(x => ({ ...x }));
        store.rows = [...store.rows];
        removeGroup(store, 1);
        // fixupIndices(store);
        return store;
    }
});
