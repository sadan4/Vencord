/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app } from "electron";

export async function fullRestart(_?: any) {
    app.relaunch();
    app.exit();
}
