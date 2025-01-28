chrome.runtime.onInstalled.addListener(() => {
    console.log("Disinformation Analyzer Extension Installed");
    loadMisinformationDomains();
});

let misinformationDomains = [];

async function loadMisinformationDomains() {
    const csvUrl = "https://raw.githubusercontent.com/JanaLasser/misinformation_domains/main/data/clean/disinformation_domains_clean.csv";
    console.log("Fetching CSV from:", csvUrl);
    try {
        const response = await fetch(csvUrl);
        const csvData = await response.text();

        misinformationDomains = csvData
            .split('\n')
            .slice(1)
            .map(line => {
                const columns = line.split(',');
                const url = columns[0].trim();
                return normalizeDomain(url);
            })
            .filter(domain => domain.length > 0);

        console.log("Loaded misinformation domains:", misinformationDomains);
    } catch (error) {
        console.error("Error loading misinformation domains:", error);
    }
}

function normalizeDomain(domain) {
    try {
        const parts = domain.replace("www.", "").split('.');
        if (parts.length > 1) {
            return parts.slice(0, -1).join('.');
        }
        return domain;
    } catch (error) {
        console.error("Error normalizing domain:", domain, error);
        return domain;
    }
}

function isMisinformationSite(url) {
    try {
        const domain = new URL(url).hostname.replace("www.", "");
        const normalizedDomain = normalizeDomain(domain);
        console.log("Checking domain:", domain, "Normalized domain:", normalizedDomain);

        return misinformationDomains.includes(normalizedDomain);
    } catch (error) {
        console.error("Error checking URL:", error);
        return false;
    }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (isMisinformationSite(tab.url)) {
            console.log("Misinformation site detected:", tab.url);
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: showWarningPopup
            });
        }
    }
});

function showWarningPopup() {
    alert("ATTENZIONE: Questo sito è noto per pubblicare contenuti disinformatori. Si consiglia cautela.");
}