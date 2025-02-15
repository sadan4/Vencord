/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* eslint-disable eqeqeq */

export default function deepEquals(t: any, n: any) {
    if (t === n)
        return !0;
    if (t && n && typeof t === "object" && typeof n === "object") {
        if (t.constructor !== n.constructor)
            return !1;
        if (Array.isArray(t)) {
            if ((i = t.length) != n.length)
                return !1;
            for (r = i; r-- != 0;)
                if (!deepEquals(t[r], n[r]))
                    return !1;
            return !0;
        }
        if (t.constructor === RegExp)
            return t.source === n.source && t.flags === n.flags;
        if (t.valueOf !== Object.prototype.valueOf)
            return t.valueOf() === n.valueOf();
        if (t.toString !== Object.prototype.toString)
            return t.toString() === n.toString();
        if ((i = (a = Object.keys(t)).length) !== Object.keys(n).length)
            return !1;
        for (r = i; r-- != 0;)
            if (!Object.prototype.hasOwnProperty.call(n, a[r]))
                return !1;
        for (r = i; r-- != 0;) {
            var i, r, a, s = a[r];
            if (!deepEquals(t[s], n[s]))
                return !1;
        }
        return !0;
    }
    return t != t && n != n;
}
