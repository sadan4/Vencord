import { Compiler, LoaderDefinitionFunction, RspackPluginInstance } from "@rspack/core";
import { resolve, relative } from "path";
import { transform } from "lightningcss";
import { hash as h64 } from "@intrnl/xxhash64";

// const __dirname = import.meta.dirname;

const makeManagedCss = (NAME, SOURCE) => {
    const name = JSON.stringify(NAME);
    const source = JSON.stringify(SOURCE);
    return `
    const name = ${name};
(window.VencordStyles ??= new Map()).set(name, {
    name,
    source: ${source},
    classNames: {},
    dom: null,
});

export default name;
`;
};
export class ManagedCssPlugin implements RspackPluginInstance {
    static PLUGIN_NAME = "ManagedCssPlugin";
    apply(compiler: Compiler) {
        const { PLUGIN_NAME } = ManagedCssPlugin;
        compiler.hooks.normalModuleFactory.tap(PLUGIN_NAME, (nmf) => {
            nmf.hooks.resolve.tap(PLUGIN_NAME, (data) => {
                if (data.request.match(/\.css\?managed$/)) {
                    data.request = `${PLUGIN_NAME}!=!${data.request}`;
                }
            });
        });
        const lRes = compiler.options.resolveLoader;
        (lRes.modules ??= ["node_modules"]).push(resolve(__dirname));
        (lRes.extensions ??= []).push(".ts");
        compiler.options.module.rules.push({
            resource: PLUGIN_NAME,
            use: [
                // {
                //     loader: "builtin:lightningcss-loader",
                //     options: {
                //         minify: true
                //     }
                // },
                "managed-css"
            ]
        });
    }
}
const loader: LoaderDefinitionFunction = function (source, map, data) {
    const { code } = transform({
        code: Buffer.from(source),
        minify: true,
        filename: relative(__dirname, this.resourcePath)
    });
    let path = relative(__dirname, this.resourcePath);
    if (this.mode === "production") {
        path = runtimeHashMessageKey(path);
    }
    return makeManagedCss(path, code.toString());
};

export default function () {
    return loader.apply(this, arguments);
};


/* eslint-disable simple-header/header */

/**
 * discord-intl
 *
 * @copyright 2024 Discord, Inc.
 * @link https://github.com/discord/discord-intl
 * @license MIT
 */


const BASE64_TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
const IS_BIG_ENDIAN = (() => {
    const array = new Uint8Array(4);
    const view = new Uint32Array(array.buffer);
    return !((view[0] = 1) & array[0]);
})();

function numberToBytes(number: number | bigint) {
    number = BigInt(number);
    const array: number[] = [];
    const byteCount = Math.ceil(Math.floor(Math.log2(Number(number)) + 1) / 8);
    for (let i = 0; i < byteCount; i++) {
        array.unshift(Number((number >> BigInt(8 * i)) & BigInt(255)));
    }

    const bytes = new Uint8Array(array);
    // The native `hashToMessageKey` always works in Big/Network Endian bytes, so this array
    // needs to be converted to the same endianness to get the same base64 result.
    return IS_BIG_ENDIAN ? bytes : bytes.reverse();
}

/**
 * Returns a consistent, short hash of the given key by first processing it through a hash digest,
 * then encoding the first few bytes to base64.
 *
 * This function is specifically written to mirror the native backend hashing function used by
 * `@discord/intl-loader-core`, to be able to hash names at runtime.
 */
export function runtimeHashMessageKey(key: string): string {
    const hash = h64(key, 0);
    const bytes = numberToBytes(hash);
    return [
        BASE64_TABLE[bytes[0] >> 2],
        BASE64_TABLE[((bytes[0] & 0x03) << 4) | (bytes[1] >> 4)],
        BASE64_TABLE[((bytes[1] & 0x0f) << 2) | (bytes[2] >> 6)],
        BASE64_TABLE[bytes[2] & 0x3f],
        BASE64_TABLE[bytes[3] >> 2],
        BASE64_TABLE[((bytes[3] & 0x03) << 4) | (bytes[3] >> 4)],
    ].join("");
}

