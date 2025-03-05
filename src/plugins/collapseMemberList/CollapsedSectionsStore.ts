/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { proxyLazy } from "@utils/lazy";
import { zustandCreate, zustandPersist } from "@webpack/common";
const idbStorage = {
    async getItem(name: string) {
        return await DataStore.get(name).then(v => v ?? null);
    },
    async setItem(name: string, value: any): Promise<void> {
        await DataStore.set(name, value);
    },
    async removeItem(name: string): Promise<void> {
        await DataStore.del(name);
    },
};
type RoleId = string;
type GuildId = string;
export interface ICollapsedSectionStore {
    byGuild: Record<GuildId, Record<RoleId, boolean>>;
    getAllForGuild(guildId: GuildId): ICollapsedSectionStore["byGuild"][GuildId];
    toggleCollapsed(guildId: GuildId, roleId: RoleId): void;
    isCollapsed(guildId: GuildId, roleId: RoleId): boolean;
}

export const useCollapsedSectionsStore = proxyLazy(() => {
    return zustandCreate(
        zustandPersist<ICollapsedSectionStore, [], [], Pick<ICollapsedSectionStore, "byGuild">>(
            (set, get) => ({
                byGuild: {},
                getAllForGuild(guildId) {
                    return get().byGuild[guildId];
                },
                toggleCollapsed(guildId, roleId) {
                    set(state => {
                        (state.byGuild[guildId] ??= {})[roleId] = !state.byGuild[guildId]?.[roleId];
                        return state;
                    });
                },
                isCollapsed(guildId, roleId) {
                    return get().byGuild[guildId]?.[roleId] ?? false;
                },
            })
            , {
                storage: idbStorage,
                name: "CollapsedSectionsStore",
                partialize({ byGuild }) {
                    return {
                        byGuild
                    };
                }
            })
    );
}
);
