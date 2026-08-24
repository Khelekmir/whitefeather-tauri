export function buildMinimalPatch(original, updated) {
    const patch = {};

    for (const key in updated) {
        if (typeof updated[key] === "object" &&
            updated[key] !== null &&
            !Array.isArray(updated[key]) &&
            typeof original[key] === "object") {

            const nested = buildMinimalPatch(original[key], updated[key]);
            if (Object.keys(nested).length > 0) {
                patch[key] = nested;
            }
        } else if (updated[key] !== original[key]) {
            patch[key] = updated[key];
        }
    }

    return patch;
}
