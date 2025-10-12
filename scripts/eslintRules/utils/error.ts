class VencordLintInternalError extends Error {
    constructor(msg?: string, opts?: ErrorOptions) {
        super(msg, opts);
        this.name = "VencordLintInternalError";
    }
}

export function error(msg: string): never {
    throw new VencordLintInternalError(msg);
}

export function unreachable(): never {
    throw new VencordLintInternalError("unreachable");
}

export function todo(msg?: string): never {
    throw new VencordLintInternalError(`TODO${msg ? `: ${msg}` : ""}`);
}

export function assert(condition: unknown, msg?: string): asserts condition {
    if (!condition) {
        throw new VencordLintInternalError(`Assertion failed${msg ? `: ${msg}` : ""}`);
    }
}
