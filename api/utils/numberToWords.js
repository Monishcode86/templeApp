/**
 * Convert number to words in English (Indian numbering format)
 */
function toEnglishWords(num) {
    const n = Math.floor(Math.abs(Number(num) || 0));
    if (n === 0) return 'Rupees Zero Only';

    const units = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
        'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convertGroup(val) {
        let str = '';
        if (val >= 100) {
            str += units[Math.floor(val / 100)] + ' Hundred ';
            val %= 100;
        }
        if (val >= 20) {
            str += tens[Math.floor(val / 10)] + (val % 10 ? ' ' + units[val % 10] : '');
        } else if (val > 0) {
            str += units[val];
        }
        return str.trim();
    }

    let words = '';
    const crores = Math.floor(n / 10000000);
    const remCrores = n % 10000000;
    const lakhs = Math.floor(remCrores / 100000);
    const remLakhs = remCrores % 100000;
    const thousands = Math.floor(remLakhs / 1000);
    const remThousands = remLakhs % 1000;

    if (crores > 0) {
        words += convertGroup(crores) + ' Crore ';
    }
    if (lakhs > 0) {
        words += convertGroup(lakhs) + ' Lakh ';
    }
    if (thousands > 0) {
        words += convertGroup(thousands) + ' Thousand ';
    }
    if (remThousands > 0) {
        words += convertGroup(remThousands);
    }

    return `Rupees ${words.trim()} Only`;
}

/**
 * Convert number to words in Tamil (Indian numbering format)
 */
function toTamilWords(num) {
    const n = Math.floor(Math.abs(Number(num) || 0));
    if (n === 0) return 'ரூபாய் பூஜ்ஜியம் மட்டும்';

    const units = [
        '', 'ஒன்று', 'இரண்டு', 'மூன்று', 'நான்கு', 'ஐந்து', 'ஆறு', 'ஏழு', 'எட்டு', 'ஒன்பது',
        'பத்து', 'பதினொன்று', 'பன்னிரண்டு', 'பதின்மூன்று', 'பதினான்கு', 'பதினைந்து',
        'பதினாறு', 'பதினேழு', 'பதினெட்டு', 'பத்தொன்பது'
    ];
    const tensPrefix = [
        '', '', 'இருபத்து ', 'முப்பத்து ', 'நாற்பத்து ', 'ஐம்பத்து ', 'அறுபத்து ', 'எழுபத்து ', 'எண்பத்து ', 'தொண்ணூற்று '
    ];
    const tensExact = [
        '', '', 'இருபது', 'முப்பது', 'நாற்பது', 'ஐம்பது', 'அறுபது', 'எழுபது', 'எண்பது', 'தொண்ணூறு'
    ];
    const hundredsPrefix = [
        '', 'நூற்று ', 'இருநூற்று ', 'முந்நூற்று ', 'நாநூற்று ', 'ஐந்நூற்று ', 'அறுநூற்று ', 'எழுநூற்று ', 'எண்ணூற்று ', 'தொளாயிரத்து '
    ];
    const hundredsExact = [
        '', 'நூறு', 'இருநூறு', 'முந்நூறு', 'நாநூறு', 'ஐந்நூறு', 'அறுநூறு', 'எழுநூறு', 'எண்ணூறு', 'தொளாயிரம்'
    ];

    function convertTwoDigits(val) {
        if (val < 20) return units[val];
        const t = Math.floor(val / 10);
        const u = val % 10;
        if (u === 0) return tensExact[t];
        return tensPrefix[t] + units[u];
    }

    function convertGroup(val) {
        let str = '';
        if (val >= 100) {
            const h = Math.floor(val / 100);
            const rem = val % 100;
            if (rem === 0) {
                return hundredsExact[h];
            } else {
                str += hundredsPrefix[h];
                str += convertTwoDigits(rem);
                return str;
            }
        }
        return convertTwoDigits(val);
    }

    let words = '';
    const crores = Math.floor(n / 10000000);
    const remCrores = n % 10000000;
    const lakhs = Math.floor(remCrores / 100000);
    const remLakhs = remCrores % 100000;
    const thousands = Math.floor(remLakhs / 1000);
    const remThousands = remLakhs % 1000;

    if (crores > 0) {
        words += (crores === 1 ? 'ஒரு கோடி ' : convertGroup(crores) + ' கோடி ');
    }
    if (lakhs > 0) {
        words += (lakhs === 1 ? 'ஒரு லட்சம் ' : convertGroup(lakhs) + ' லட்சம் ');
    }
    if (thousands > 0) {
        if (thousands === 1) {
            words += (remThousands > 0 ? 'ஆயிரத்து ' : 'ஆயிரம் ');
        } else {
            const thGroup = convertGroup(thousands);
            words += (remThousands > 0 ? thGroup + ' ஆயிரத்து ' : thGroup + ' ஆயிரம் ');
        }
    }
    if (remThousands > 0) {
        words += convertGroup(remThousands);
    }

    return `ரூபாய் ${words.trim()} மட்டும்`;
}

module.exports = {
    toEnglishWords,
    toTamilWords
};
