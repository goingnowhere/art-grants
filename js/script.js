const SPREADSHEET_ID = '2PACX-1vSGOuiHGuAinQZKdFPFfNE3w_h8Q-_LkpVz_fdEC31CNk0mentc8Ct-G2MjlrfilHaItfQ4xgwaEBil';
const CSV_URL = `https://docs.google.com/spreadsheets/d/e/${SPREADSHEET_ID}/pub?output=csv`;

function parseCSV(text) {
    if (!text || !text.trim()) return { headers: [], rows: [] };

    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentField += '"';
                i += 2;
                continue;
            } else {
                inQuotes = !inQuotes;
                i++;
                continue;
            }
        }

        if (char === ',' && !inQuotes) {
            currentRow.push(currentField.trim());
            currentField = '';
            i++;
            continue;
        }

        if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i += 2;
            } else {
                i++;
            }
            
            if (currentField !== '' || currentRow.length > 0) {
                currentRow.push(currentField.trim());
                if (currentRow.some(field => field.trim())) {
                    rows.push([...currentRow]);
                }
                currentRow = [];
                currentField = '';
            }
            continue;
        }

        currentField += char;
        i++;
    }

    if (currentField !== '' || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field.trim())) {
            rows.push(currentRow);
        }
    }

    if (rows.length === 0) return { headers: [], rows: [] };

    const headers = rows[0].map(h => h.trim());
    const dataRows = rows.slice(1).map(row => {
        const rowObj = {};
        headers.forEach((header, index) => {
            rowObj[header] = (row[index] || '').trim();
        });
        return rowObj;
    }).filter(row => {
        return Object.values(row).some(val => val && val.trim());
    });

    return { headers, rows: dataRows };
}

function getFieldValue(row, headers, fieldName) {
    const normalizedFieldName = fieldName.toLowerCase().trim();
    
    if (row[fieldName] !== undefined && row[fieldName] !== null) {
        return String(row[fieldName]).trim();
    }
    
    const header = headers.find(h => {
        return h.toLowerCase().trim() === normalizedFieldName;
    });
    
    if (header && row[header] !== undefined && row[header] !== null) {
        return String(row[header]).trim();
    }
    
    const partialMatch = headers.find(h => {
        const normalizedHeader = h.toLowerCase().trim();
        return normalizedHeader.includes(normalizedFieldName) || normalizedFieldName.includes(normalizedHeader);
    });
    
    if (partialMatch && row[partialMatch] !== undefined && row[partialMatch] !== null) {
        return String(row[partialMatch]).trim();
    }
    
    return '';
}

function findColumn(row, headers, possibleNames) {
    for (const name of possibleNames) {
        const value = getFieldValue(row, headers, name);
        if (value) return value;
    }
    
    for (const header of headers) {
        const normalizedHeader = header.toLowerCase().trim();
        for (const name of possibleNames) {
            const normalizedName = name.toLowerCase().trim();
            if (normalizedHeader === normalizedName || 
                normalizedHeader.includes(normalizedName) ||
                normalizedName.includes(normalizedHeader)) {
                const value = String(row[header] || '').trim();
                if (value) return value;
            }
        }
    }
    return '';
}

function formatText(text) {
    if (!text) return '';
    return escapeHtml(text).replace(/\n/g, '<br>');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStatusClass(status) {
    if (!status) return '';
    const normalized = status.toLowerCase().trim();
    if (normalized.includes('funded') && !normalized.includes('not')) {
        return 'funded';
    }
    if (normalized.includes('not') && normalized.includes('funded')) {
        return 'not-funded';
    }
    if (normalized.includes('review') || normalized.includes('under')) {
        return 'under-review';
    }
    return '';
}

function getStatusLabel(status) {
    if (!status) return '';
    const normalized = status.toLowerCase().trim();
    if (normalized.includes('funded') && !normalized.includes('not')) {
        return 'Funded';
    }
    if (normalized.includes('not') && normalized.includes('funded')) {
        return 'Not Funded';
    }
    if (normalized.includes('review') || normalized.includes('under')) {
        return 'Under Review';
    }
    return status;
}

function createProposalCard(row, headers) {
    const card = document.createElement('div');
    card.className = 'proposal-card';

    const title = findColumn(row, headers, ['Title', 'title']) || 'Untitled Proposal';
    const name = findColumn(row, headers, ['Name', 'name']);
    const email = findColumn(row, headers, ['Email', 'email', 'Email address']);
    const description = findColumn(row, headers, ['Description', 'description']);
    const technicalDetails = findColumn(row, headers, ['Technical details', 'Technical Details']);
    const budget = findColumn(row, headers, ['Budget', 'budget']);
    const spaceRequirements = findColumn(row, headers, ['Space requirements', 'Space Requirements']);
    const locationRequirements = findColumn(row, headers, ['Location requirements', 'Location Requirements']);
    const powerRequirements = findColumn(row, headers, ['Power requirements', 'Power Requirements']);
    const sound = findColumn(row, headers, ['Sound', 'sound']);
    const safety = findColumn(row, headers, ['Safety', 'safety']);
    const strike = findColumn(row, headers, ['Strike', 'strike']);
    const imageUrl = findColumn(row, headers, ['Image', 'image']);
    const coCreation = findColumn(row, headers, ['Co-creation', 'Co-creation']);
    const team = findColumn(row, headers, ['Team', 'team']);
    const status = findColumn(row, headers, ['Status', 'status']);

    let coverImage = imageUrl.trim();
    if (coverImage.startsWith('"') && coverImage.endsWith('"')) {
        coverImage = coverImage.slice(1, -1);
    }

    let authorInfo = '';
    if (name) {
        authorInfo = name;
        if (email) {
            authorInfo += ` <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`;
        }
    } else if (email) {
        authorInfo = `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`;
    }

    const statusClass = getStatusClass(status);
    const statusLabel = getStatusLabel(status);
    const statusHTML = status ? `<span class="status ${statusClass}">${escapeHtml(statusLabel)}</span>` : '';

    card.innerHTML = `
        <header>
            <h2>${escapeHtml(title)}</h2>
            ${statusHTML}
            ${authorInfo ? `<div class="author">${authorInfo}</div>` : ''}
        </header>
        <main>
            ${coverImage ? `<img class="cover-image" src="${coverImage.replace(/"/g, '&quot;')}" alt="${escapeHtml(title)}" loading="lazy" onerror="this.style.display='none'">` : ''}
            <div class="summary">${formatText(description || 'No description provided.')}</div>
            <details>
                <summary>View full details</summary>
                <div class="details-content">
                    ${technicalDetails ? `
                        <div class="detail-section">
                            <h3>Technical Details</h3>
                            <p>${formatText(technicalDetails)}</p>
                        </div>
                    ` : ''}
                    ${budget ? `
                        <div class="detail-section">
                            <h3>Budget</h3>
                            <p>${formatText(budget)}</p>
                        </div>
                    ` : ''}
                    ${spaceRequirements ? `
                        <div class="detail-section">
                            <h3>Space Requirements</h3>
                            <p>${formatText(spaceRequirements)}</p>
                        </div>
                    ` : ''}
                    ${locationRequirements ? `
                        <div class="detail-section">
                            <h3>Location Requirements</h3>
                            <p>${formatText(locationRequirements)}</p>
                        </div>
                    ` : ''}
                    ${powerRequirements ? `
                        <div class="detail-section">
                            <h3>Power Requirements</h3>
                            <p>${formatText(powerRequirements)}</p>
                        </div>
                    ` : ''}
                    ${sound ? `
                        <div class="detail-section">
                            <h3>Sound</h3>
                            <p>${formatText(sound)}</p>
                        </div>
                    ` : ''}
                    ${safety ? `
                        <div class="detail-section">
                            <h3>Safety</h3>
                            <p>${formatText(safety)}</p>
                        </div>
                    ` : ''}
                    ${strike ? `
                        <div class="detail-section">
                            <h3>Strike</h3>
                            <p>${formatText(strike)}</p>
                        </div>
                    ` : ''}
                    ${coCreation ? `
                        <div class="detail-section">
                            <h3>Co-creation</h3>
                            <p>${formatText(coCreation)}</p>
                        </div>
                    ` : ''}
                    ${team ? `
                        <div class="detail-section">
                            <h3>Team</h3>
                            <p>${formatText(team)}</p>
                        </div>
                    ` : ''}
                </div>
            </details>
        </main>
    `;

    return card;
}

function displayProposals(data) {
    const { headers, rows } = data;
    
    if (headers.length === 0 || rows.length === 0) {
        document.getElementById('proposals-list').innerHTML = 
            '<div class="empty">No proposals available</div>';
        document.getElementById('loading').style.display = 'none';
        return;
    }

    const completeRows = rows.filter(row => {
        const title = getFieldValue(row, headers, 'Title');
        return title && title.trim().length > 0;
    });

    if (completeRows.length === 0) {
        document.getElementById('proposals-list').innerHTML = 
            '<div class="empty">No complete proposals available</div>';
        document.getElementById('loading').style.display = 'none';
        return;
    }

    const container = document.getElementById('proposals-list');
    const fragment = document.createDocumentFragment();

    completeRows.forEach(row => {
        const card = createProposalCard(row, headers);
        fragment.appendChild(card);
    });

    container.appendChild(fragment);
    document.getElementById('loading').style.display = 'none';
}

function showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').textContent = message;
    document.getElementById('error').style.display = 'block';
}

async function fetchData() {
    try {
        const response = await fetch(CSV_URL);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }

        const csvText = await response.text();
        const data = parseCSV(csvText);
        displayProposals(data);
    } catch (error) {
        console.error('Error fetching data:', error);
        showError(`Error loading data: ${error.message}. Please make sure the spreadsheet is publicly accessible.`);
    }
}

fetchData();

