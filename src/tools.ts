import { Request } from 'playwright';

export const convertPlaywrightRequestToCurl = async (request: Request): Promise<string> => {
    const lines = [];
    lines.push(`curl -X ${request.method()} '${request.url()}'`);
    for (const header of await request.headersArray()) {
        lines.push(`-H '${header.name}: ${header.value}'`);
    }

    if (request.postData()) {
        lines.push(`--raw-data '${request.postData()}'`);
    }

    lines.push('--compressed');

    return lines.join(' \\\n\t');
};
