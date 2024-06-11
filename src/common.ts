import { dirname } from 'path';

export function getProjectRoot() {
    const script = process.argv[1];
    const basePath = dirname(dirname(script));

    return basePath;
}
