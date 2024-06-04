/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import "./style.css";

import definePlugin from "@utils/types";
export default definePlugin({
    patches: [
        {
            find: "let{type:N,textValue:p,maxCharacterCount",
            replacement: {
                match: /let{type/,
                replace: "e.showRemainingCharsAfterCount=4000;e.maxCharacterCount=0;$&"
            }
        },
        {
            find: "let{type:N,textValue:p,maxCharacterCount",
            replacement: {
                match: /(,.=)(.-.)(,)/,
                replace: "$1$self.genNumber(e)$3"
            }
        }
    ],
    name: "_Show Character Count",
    authors: [{
        name: "sadan",
        id: 521819891141967883n
    }],
    description: "Show your character count while typing",
    genNumber(e: any): string {
        console.log(e);
        if (!e.textValue) return "";
        return e.textValue.length.toString();
    }
});
