/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { ErrorCard } from "@components/ErrorCard";
import { Margins } from "@utils/margins";
import { useAwaiter, useForceUpdater } from "@utils/react";
import { Button, Forms, Toasts } from "@webpack/common";
import { PlainSettings, Settings } from "Vencord";

import { AddonCard } from "./AddonCard";
import { SettingsTab, wrapTab } from "./shared";

function Pending() {
    return <Forms.FormText tag="h2">Loading...</Forms.FormText>;
}

interface ErrorProps {
    error: Error;
}
function Err({ error }: ErrorProps) {
    console.error(error);
    return (
        <ErrorCard
            style={{
                overflow: "hidden",
            }}
        >
            <h1>Oh no!</h1>
            <p>{error.name}</p>
            <code>
                {error.message}
                {!!error.stack && (
                    <pre className={Margins.top8}>{error.stack}</pre>
                )}
            </code>
        </ErrorCard>
    );
}
interface Split {
    enabled: string[];
    disabled: string[];
}

interface BisectState {
    enabled: boolean;
    currentSplit: Split;
    /**
     * the users enabled plugins before they started the bisect
     */
    beforeBisect: string[];
}
function getEnabledPlugins(): string[] {
    return Object.entries(PlainSettings.plugins)
        .filter(([, v]) => v.enabled)
        .map(([k]) => k)
        .filter(x => !x.endsWith("API"));
}
function generateSplit(plugins: string[]): Split {
    if (plugins.length % 2 === 0) {
        return {
            enabled: plugins.slice(0, plugins.length / 2),
            disabled: plugins.slice(plugins.length / 2),
        };
    }
    return {
        enabled: plugins.slice(0, (plugins.length / 2) | 0),
        disabled: plugins.slice((plugins.length / 2) | 0),
    };
}
interface BisectProps {
    data: BisectState;
    update: () => void;
}
function setPluginStates(state: Split) {
    for (const plugin of state.disabled) {
        Settings.plugins[plugin].enabled = false;
    }
    for (const plugin of state.enabled) {
        Settings.plugins[plugin].enabled = true;
    }

}
const DS_KEY = "vc-bisect-state";
function BisectPanel({ data, update }: BisectProps) {
    const { enabled } = data ?? { enabled: false };
    if (!enabled)
        return (
            <>
                <Forms.FormText variant="text-lg/bold">
                    You are not currently bisecting, click here to start
                </Forms.FormText>
                <Button
                    onClick={() => {
                        const plugins = getEnabledPlugins();
                        const split = generateSplit(plugins);
                        setPluginStates(split);
                        const data: BisectState = {
                            enabled: true,
                            currentSplit: split,
                            beforeBisect: plugins,
                        };
                        DataStore.set(DS_KEY, data).then(update);
                    }}
                >
                    Start Bisect
                </Button>
            </>
        );
    return (<>
        <Forms.FormText variant="heading-lg/medium">Remember to reload</Forms.FormText>
        <Button onClick={() => {
            const { currentSplit } = data;
            if (!currentSplit) {
                Toasts.show({
                    id: Toasts.genId(),
                    type: Toasts.Type.FAILURE,
                    message: "An error occured, check console for more info",
                    options: {
                        duration: 2000,
                        position: Toasts.Position.TOP,
                    }
                });
                throw new Error("No current split");
            }
            const newState: BisectState = {
                enabled: true,
                currentSplit: generateSplit(currentSplit.enabled),
                beforeBisect: data.beforeBisect
            };
            setPluginStates(newState.currentSplit);
            DataStore.set(DS_KEY, newState).then(update);
        }}>The bug occurs</Button>
        <Button onClick={() => {
            const { currentSplit } = data;
            if (!currentSplit) {
                Toasts.show({
                    id: Toasts.genId(),
                    type: Toasts.Type.FAILURE,
                    message: "An error occured, check console for more info",
                    options: {
                        duration: 2000,
                        position: Toasts.Position.TOP,
                    }
                });
                throw new Error("No current split");
            }
            const newState: BisectState = {
                enabled: true,
                currentSplit: generateSplit(currentSplit.disabled),
                beforeBisect: data.beforeBisect
            };
            setPluginStates(newState.currentSplit);
            DataStore.set(DS_KEY, newState).then(update);
        }}>The bug is gone</Button>
        <Button color={Button.Colors.RED} onClick={() => {
            for (const plugin of data.beforeBisect) {
                Settings.plugins[plugin].enabled = true;
            }
            const newState: Partial<BisectState> = {
                enabled: false
            };
            DataStore.set(DS_KEY, newState).then(update);
        }}>CANCEL</Button>
        <h1>ENABLED:</h1>
        <div className="vc-plugins-grid">{data.currentSplit.enabled.map(x => {
            const plugin = Vencord.Plugins.plugins[x];
            if (plugin === undefined) return <AddonCard description="Plugin not found" name={x} enabled={false} setEnabled={() => void 0} />;
            return <AddonCard description={plugin.description} name={plugin.name} enabled={true} setEnabled={() => void 0} />;
        })}</div>
        <h1>DISABLED:</h1>
        <div className="vc-plugins-grid">{data.currentSplit.disabled.map(x => {
            const plugin = Vencord.Plugins.plugins[x];
            if (plugin === undefined) return <AddonCard description="Plugin not found" name={x} enabled={false} setEnabled={() => void 0} />;
            return <AddonCard description={plugin.description} name={plugin.name} enabled={false} setEnabled={() => void 0} />;
        })}</div>
    </>);
}
function Bisect() {
    const [dep, updater] = useForceUpdater(true);
    const [value, err, pending] = useAwaiter(
        async () => {
            return DataStore.get(DS_KEY);
        },
        {
            deps: [dep],
            fallbackValue: null,
        }
    );
    console.log(value, err, pending);
    return (
        <SettingsTab title="Bisect">
            <Forms.FormText>
                Find the plugin that is causing an issue.
                <br />
                <br />
                To being press start
                <br />
                <br />
                <Forms.FormText variant="text-lg/bold">
                    It is reccommended to make a backup of your settings just in
                    case
                </Forms.FormText>
                <br />
                <br />
                {pending && <Pending />}
                {value !== null && !err && (
                    <BisectPanel data={value} update={updater} />
                )}
                {err && <Err error={err} />}
            </Forms.FormText>
        </SettingsTab>
    );
}
export default wrapTab(Bisect, "Vencord Bisect");
