import { ungzip } from 'pako';

// Compressed copy of the user-supplied DBot XML. Keeping the payload compressed avoids
// inflating the Free Bots component while preserving the original XML byte-for-byte.
const ULTIMATE_EVEN_ODD_SWITCHER_GZIP_BASE64 = 'H4sIAEKloGoC/+19a3uayvf2+/+nMGl7PUlTCaDiob/sFgURFVAOnno1FAEV5aCctWk/+2MOzW4bo6gkTbrzYl+7RhlmZt0z6zBr';

const decodeBase64Gzip = (value: string): string => {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return ungzip(bytes, { to: 'string' }) as string;
};

export const ULTIMATE_EVEN_ODD_SWITCHER_XML = decodeBase64Gzip(ULTIMATE_EVEN_ODD_SWITCHER_GZIP_BASE64);
