import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';

// Initialize the Apify SDK
await Actor.init();

interface ProxyConfigurationInput {
    useApifyProxy: boolean;
    apifyProxyGroups?: string[]
    apifyProxyCountry?: string
    proxyUrls?: string[]
}

interface InputSchema {
    urls?: string[];
    proxyConfiguration?: ProxyConfigurationInput;
    cookies?: string[];
}

interface ActorState {
    cookies: Record<string, { url: string, value: string }[]>;
}

const store = await Actor.openKeyValueStore();
const output = await store.getAutoSavedValue<ActorState>('OUTPUT', { cookies: {} });

const {
    urls,
    proxyConfiguration: proxyConfigurationOptions,
    cookies: cookiesToSave,
} = await Actor.getInput<InputSchema>() ?? {};

if (!urls) throw new Error('No URLs provided!');
if (!cookiesToSave) throw new Error('No cookies provided!');

const proxyConfiguration = await Actor.createProxyConfiguration(proxyConfigurationOptions);

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    persistCookiesPerSession: false,
    headless: true,
    preNavigationHooks: [
        async ({ page, log }) => {
            page.on('response', async (response) => {
                const headers = await response.allHeaders();
                const setCookieHeader = headers['set-cookie'];
                if (!setCookieHeader) {
                    return;
                }

                const setCookieHeaderArray = setCookieHeader.split('\n');

                for (const cookie of setCookieHeaderArray) {
                    const kvPairString = cookie.split(';')[0];
                    if (!kvPairString || !kvPairString.includes('=')) {
                        continue;
                    }

                    const [key, value] = kvPairString.split('=');
                    if (!key || !value) {
                        continue;
                    }

                    if (!cookiesToSave.includes(key)) {
                        continue;
                    }

                    if (!output.cookies[key]) {
                        output.cookies[key] = [];
                    }

                    log.info(`Saving cookie ${key}=${value} set by ${response.url()}`);
                    output.cookies[key].push({ url: response.url(), value });
                }
            });
        },
    ],
    requestHandler: async ({ request, log }) => {
        log.info(`Processed ${request.url}...`);
    },
});

await crawler.run(urls);

// Exit successfully
await Actor.exit();
