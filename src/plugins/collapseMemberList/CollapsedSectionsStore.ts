/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { proxyLazy } from "@utils/lazy";
import { zustandCreate } from "@webpack/common";
const idbStorage = {
    async getItem(name: string) {
        return il(await DataStore.get(name).then(v => v ?? null));
    },
    async setItem(name: string, value: any): Promise<void> {
        console.trace("called");
        await DataStore.set(name, value);
    },
    async removeItem(name: string): Promise<void> {
        console.trace("called");
        await DataStore.del(name);
    },
};
type RoleId = string;
type GuildId = string;
interface ICollapsedSectionStore {
    byGuild: Map<GuildId, Map<RoleId, boolean>>;
    getAllForGuild(guildId: GuildId): ReturnType<ICollapsedSectionStore["byGuild"]["get"]>;
    toggleCollapsed(guildId: GuildId, roleId: RoleId): void;
    isCollapsed(guildId: GuildId, roleId: RoleId): boolean;
    init(): void;
}
const il = <T>(e: T): T => console.trace(e) ?? e;

export const useCollapsedSectionsStore = proxyLazy(() => {
    return zustandCreate<ICollapsedSectionStore>(
        // zustandPersist<ICollapsedSectionStore, [], [], Pick<ICollapsedSectionStore, "byGuild">>(
        (set, get) => ({
            byGuild: new Map(),
            getAllForGuild(guildId) {
                return {};
                return il(get().byGuild[guildId]);
            },
            toggleCollapsed(guildId, roleId) {
                return;
                set(state => {
                    (state.byGuild[guildId] ??= {})[roleId] = !state.byGuild[guildId]?.[roleId];
                    return il(state);
                });
            },
            isCollapsed(guildId, roleId) {
                return false;
                return il(get().byGuild[guildId]?.[roleId] ?? false);
            },
            init() {
                set({ byGuild: new Map() });
            }
        })
        // ,{
        //     storage: idbStorage,
        //     partialize({ byGuild }) {
        //         return {
        //             byGuild
        //         };
        //     },
        //     onRehydrateStorage() {
        //         console.log("before rehydrate");
        //         return () => {
        //             console.log("after rehydrate");
        //         };
        //     },
        //     name: "CollapsedSectionsStore",
        // })
    );
}
);
