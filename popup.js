document.addEventListener('DOMContentLoaded', async () => {
    initializePopup(); // Mostra l'icona di caricamento all'apertura
    setupEventListeners();
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            console.error("No valid tab found");
            document.getElementById('loading').style.display = "none"; // Nascondi l'icona se non c'è una tab valida
            return;
        }

        // Esegui l'estrazione del contenuto della pagina
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: extractPageContent
        }, async (results) => {
            if (results && results[0] && results[0].result) {
                const pageContent = results[0].result;
                const apiKey = document.getElementById('apiKeyInput').value.trim();

                if (!apiKey) {
                    document.getElementById('loading').style.display = "none"; // Nascondi l'icona se non c'è l'API key
                    document.getElementById('settingsForm').style.display = "block";
                    return;
                }

                try {
                    const response = await fetch('https://disinformation-server.onrender.com/preanalyze', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: pageContent, apiKey }),
                    });

                    if (!response.ok) {
                        throw new Error('Error during page content preanalysis.');
                    }

                    const preanalysisResult = await response.json();
                    displayPreanalysisResult(preanalysisResult.preanalysis);
                } catch (error) {
                    console.error("Error during preanalysis:", error);
                    alert(`Preanalysis error: ${error.message}`);
                } finally {
                    document.getElementById('loading').style.display = "none"; // Nascondi l'icona dopo la preanalisi
                }
            } else {
                console.error("No content extracted from page");
                alert("Unable to extract page content");
                document.getElementById('loading').style.display = "none"; // Nascondi l'icona se non c'è contenuto
            }
        });
    } catch (error) {
        console.error("Error in initialization:", error);
        alert(`Initialization error: ${error.message}`);
        document.getElementById('loading').style.display = "none"; // Nascondi l'icona in caso di errore
    }
});

async function initializePopup() {
    // Mostra l'icona di caricamento all'apertura
    document.getElementById('loading').style.display = "block";

    // Nascondi gli altri elementi
    ['output', 'preanalysisOutput', 'analysisResults'].forEach(id => {
        document.getElementById(id).style.display = "none";
    });

    // Carica l'API key se presente
    chrome.storage.local.get(['groqApiKey', 'preanalysisResult', 'preanalysisUrl'], async data => {
        if (data.groqApiKey) document.getElementById('apiKeyInput').value = data.groqApiKey;

        // Ottieni l'URL corrente della tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentUrl = tab.url;

        // Se ci sono risultati di preanalisi salvati e l'URL corrisponde, visualizzali
        if (data.preanalysisResult && data.preanalysisUrl === currentUrl) {
            displayPreanalysisResult(data.preanalysisResult);
            document.getElementById('loading').style.display = "none"; // Nascondi l'icona di caricamento
        } else {
            // Se non ci sono risultati salvati o l'URL non corrisponde, esegui la preanalisi
            if (tab && tab.id) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: extractPageContent
                }, async (results) => {
                    if (results && results[0] && results[0].result) {
                        const pageContent = results[0].result;
                        const apiKey = document.getElementById('apiKeyInput').value.trim();

                        if (!apiKey) {
                            document.getElementById('loading').style.display = "none";
                            document.getElementById('settingsForm').style.display = "block";
                            return;
                        }

                        try {
                            const response = await fetch('https://disinformation-server.onrender.com/preanalyze', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ text: pageContent, apiKey }),
                            });

                            if (!response.ok) {
                                throw new Error('Error during page content preanalysis.');
                            }

                            const preanalysisResult = await response.json();
                            displayPreanalysisResult(preanalysisResult.preanalysis);
                            savePreanalysisResult(preanalysisResult.preanalysis, currentUrl); // Salva l'URL insieme ai risultati
                        } catch (error) {
                            console.error("Error during preanalysis:", error);
                            alert(`Preanalysis error: ${error.message}`);
                        } finally {
                            document.getElementById('loading').style.display = "none";
                        }
                    } else {
                        console.error("No content extracted from page");
                        alert("Unable to extract page content");
                        document.getElementById('loading').style.display = "none";
                    }
                });
            }
        }
    });
}

function setupEventListeners() {
    console.log("Configuro gli event listener"); // Debug

    document.getElementById('closeButton').addEventListener('click', () => window.close());

    document.body.addEventListener('click', e => e.stopPropagation());
    document.querySelectorAll('button, input, textarea').forEach(el => el.addEventListener('click', e => e.stopPropagation()));

    document.getElementById('settingsIcon').addEventListener('click', () => {
        const settingsForm = document.getElementById('settingsForm');
        settingsForm.style.display = settingsForm.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('saveApiKeyBtn').addEventListener('click', saveApiKey);

    document.getElementById('manualAnalysisBtn').addEventListener('click', () => {
        const section = document.getElementById('manualAnalysisSection');
        section.style.display = section.style.display === 'block' ? 'none' : 'block';
        document.getElementById('analyzeBtn').addEventListener('click', analyzeText);
    });

    // Aggiungi l'event listener per il pulsante di download dell'analisi manuale
    document.getElementById('downloadRawBtn').addEventListener('click', () => {
        const wholeOutput = document.getElementById('wholeOutput');
        if (wholeOutput && wholeOutput.textContent) {
            const blob = new Blob([wholeOutput.textContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'analysis_output.txt';
            a.click();
            URL.revokeObjectURL(url);
        } else {
            alert('No raw output available to download.');
        }
    });

    // Aggiungi l'event listener per il pulsante di download della preanalisi
    document.getElementById('downloadPreanalysisBtn').addEventListener('click', () => {
        const preanalysisElement = document.getElementById('preanalysis');
        if (preanalysisElement && preanalysisElement.textContent) {
            const blob = new Blob([preanalysisElement.textContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'preanalysis_output.txt';
            a.click();
            URL.revokeObjectURL(url);
        } else {
            alert('No preanalysis output available to download.');
        }
    });
}

async function saveApiKey() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    if (!apiKey) return alert('Insert a valid API key.');

    const isValid = await checkApiKey(apiKey);
    if (isValid) {
        chrome.storage.local.set({ groqApiKey: apiKey });
        document.getElementById('settingsForm').style.display = 'none';
    } else {
        alert('Invalid API key, retry.');
    }
}

async function checkApiKey(apiKey) {
    try {
        const response = await fetch('https://disinformation-server.onrender.com/check-api-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey }),
        });
        const result = await response.json();
        return response.ok && result.valid;
    } catch (error) {
        console.error("API key verification error:", error);
        return false;
    }
}

async function analyzeText() {
    const text = document.getElementById('textInput').value.trim();
    const apiKey = document.getElementById('apiKeyInput').value.trim();

    if (!text || !apiKey || text.split(/\s+/).length < 50) {
        document.getElementById('errorMessage').style.display = 'block';
        return;
    }

    try {
        document.getElementById('loading').style.display = "block";
        document.getElementById('output').style.display = "none";

        const response = await fetch('https://disinformation-server.onrender.com/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, apiKey }),
        });

        if (!response.ok) {
            const errorResponse = await response.json();
            throw new Error(errorResponse.error || response.statusText);
        }

        const result = await response.json();
        console.log("Analysis result:", result); // Debug: stampa i dati restituiti dal server
        displayAnalysisResult(result);
    } catch (error) {
        console.error("Error during analysis:", error);
        alert(`Error during analysis: ${error.message}`);
    } finally {
        document.getElementById('loading').style.display = "none";
    }
}
function displayAnalysisResult(analysisResult) {
    const outputDiv = document.getElementById('output');
    const analysisResults = document.getElementById('analysisResults');
    const preanalysisOutput = document.getElementById('preanalysisOutput');
    const formattedOutput = document.getElementById('formattedOutput');
    const wholeOutput = document.getElementById('wholeOutput');

    if (outputDiv) outputDiv.style.display = "block";
    if (analysisResults) analysisResults.style.display = "block";
    if (preanalysisOutput) preanalysisOutput.style.display = "none";

    // Aggiorna i campi principali
    const scoreElement = document.getElementById('score');
    if (scoreElement) scoreElement.textContent = analysisResult.disinformation_score || 'N/A';

    const sentimentElement = document.getElementById('sentiment');
    if (sentimentElement) sentimentElement.textContent = analysisResult.sentiment || 'N/A';

    // Verifica la struttura di parsed_judge_output
    const parsedOutput = analysisResult.parsed_judge_output || {};
    console.log("Parsed output:", parsedOutput);

    const keys = ["Overall Assessment of Disinformation", "Overall Assessment of Authenticity", "Summary of Key Findings", "Final Verdict", "Confidence Score"];

    keys.forEach(key => {
        const elementId = key.replace(/\s+/g, '').toLowerCase();
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = parsedOutput[key] || 'N/A';
        } else {
            console.error(`Element not found for key: ${key}`);
        }
    });

    // Memorizza l'output grezzo per il download
    if (wholeOutput) {
        wholeOutput.textContent = analysisResult.whole || 'No raw output available.';
    }

    // Mostra il pulsante di download
    const downloadRawBtn = document.getElementById('downloadRawBtn');
    if (downloadRawBtn) downloadRawBtn.style.display = "block";

    // Salva i risultati dell'analisi manuale
    saveManualAnalysisResult(analysisResult);
}
function formatSubsections(content) {
    // Rimuovi numeri seguiti da un punto e due punti nel testo
    content = content.replace(/(\d+\.)|:/g, '');

    // Verifica se il contenuto inizia con asterischi per le sottocategorie
    if (content.includes('**')) {
        // Divide il contenuto in base agli asterischi doppi
        const subsections = content.split('**').filter(sub => sub.trim().length > 0);
        
        return `<ul>${subsections.map(sub => {
            // Divide il titolo dal contenuto
            const parts = sub.split('**');
            if (parts.length > 1) {
                // Se c'è un titolo e un contenuto
                const title = parts[0].trim();
                const description = parts[1].trim();
                return `<li><strong>${title}</strong> ${description}</li>`;
            } else {
                // Se è solo contenuto senza titolo
                return `<li>${sub.trim()}</li>`;
            }
        }).join('')}</ul>`;
    }
    // Se non ci sono sottocategorie, restituisce un paragrafo normale
    return `<p>${content}</p>`;
}


function formatSection(title, content) {
    return `<div class="preanalysis-section">
                <h3>${title}</h3>
                ${formatSubsections(content)}
            </div>`;
}
function savePreanalysisResult(preanalysisResult, url) {
    chrome.storage.local.set({ preanalysisResult: preanalysisResult, preanalysisUrl: url }, () => {
        console.log("Preanalysis result and URL saved");
    });
}
function saveManualAnalysisResult(analysisResult) {
    chrome.storage.local.set({ manualAnalysisResult: analysisResult }, () => {
        console.log("Manual analysis result saved");
    });
}
function displayPreanalysisResult(preanalysisResult, url) {
    const outputDiv = document.getElementById('output');
    const preanalysisOutput = document.getElementById('preanalysisOutput');
    const preanalysisElement = document.getElementById('preanalysis');
    const downloadPreanalysisBtn = document.getElementById('downloadPreanalysisBtn');

    outputDiv.style.display = "block";
    preanalysisOutput.style.display = "block";

    if (preanalysisResult) {
        let formattedText = '<div class="preanalysis-content">';
        const sections = ["General Analysis", "Potential Disinformation Traits", "Credibility Assessment", "Confidence Score"];

        sections.forEach(section => {
            if (preanalysisResult[section]) {
                formattedText += formatSection(section, preanalysisResult[section]);
            }
        });

        formattedText += '</div>';
        preanalysisElement.innerHTML = formattedText;

        if (downloadPreanalysisBtn) {
            downloadPreanalysisBtn.style.display = "block";
        }

        savePreanalysisResult(preanalysisResult, url);
    } else {
        preanalysisElement.innerHTML = "<p>No preanalysis available.</p>";
        if (downloadPreanalysisBtn) {
            downloadPreanalysisBtn.style.display = "none";
        }
    }
}
async function extractPageContent() {
    try {
        const selectors = ['main', 'article', 'div[role="main"]', 'div.content', 'div.article', 'div.post', 'body'];
        let mainContent = null;

        for (const selector of selectors) {
            mainContent = document.querySelector(selector);
            if (mainContent) break;
        }

        if (!mainContent) mainContent = document.body;

        let text = mainContent.innerText || mainContent.textContent;
        text = text.replace(/\s+/g, ' ').trim();
        return text.split(/\s+/).slice(0, 1000).join(' ');
    } catch (error) {
        console.error("Error during extraction:", error);
        return '';
    }
}