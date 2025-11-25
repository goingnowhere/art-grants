const SPREADSHEET_ID = '2PACX-1vSGOuiHGuAinQZKdFPFfNE3w_h8Q-_LkpVz_fdEC31CNk0mentc8Ct-G2MjlrfilHaItfQ4xgwaEBil';
const CSV_URL = `https://docs.google.com/spreadsheets/d/e/${SPREADSHEET_ID}/pub?output=csv`;

const sortSelect = document.getElementById('sort-select');
const statusChips = document.querySelectorAll('.status-chip');
const viewButtons = document.querySelectorAll('.view-button');
const proposalsContainer = document.getElementById('proposals-list');

let sortMode = '';
let viewMode = 'cards';
let proposalData = [];
let filteredList = [];

const statusFilters = Array.from(statusChips).reduce((acc, chip) => {
    const key = chip.dataset.status;
    acc[key] = true;
    chip.addEventListener('click', () => toggleStatusFilter(chip, key));
    return acc;
}, {});

viewButtons.forEach(button => {
    button.addEventListener('click', () => {
        const nextView = button.dataset.view;
        if (nextView === viewMode) return;
        viewMode = nextView;
        viewButtons.forEach(btn => {
            const isActive = btn.dataset.view === viewMode;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
        });
        renderProposals();
    });
});

sortSelect.addEventListener('change', event => {
    sortMode = event.target.value;
    applyFiltersAndRender();
});

function toggleStatusFilter(chip, key) {
    statusFilters[key] = !statusFilters[key];
    chip.classList.toggle('is-active', statusFilters[key]);
    chip.setAttribute('aria-pressed', String(statusFilters[key]));
    applyFiltersAndRender();
}

function parseCSV(text) {
    if (!text || !text.trim()) return { headers: [], rows: [] };

    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentField += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            currentRow.push(currentField.trim());
            currentField = '';
            continue;
        }

        if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            currentRow.push(currentField.trim());
            if (currentRow.some(cell => cell.trim())) {
                rows.push([...currentRow]);
            }
            currentRow = [];
            currentField = '';
            continue;
        }

        currentField += char;
    }

    if (currentField !== '' || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some(cell => cell.trim())) {
            rows.push(currentRow);
        }
    }

    if (!rows.length) return { headers: [], rows: [] };

    const headers = rows[0].map(h => h.trim());
    const dataRows = rows.slice(1)
        .map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = (row[index] || '').trim();
            });
            return obj;
        })
        .filter(row => Object.values(row).some(val => val && val.trim()));

    return { headers, rows: dataRows };
}

function getFieldValue(row, headers, fieldName) {
    const normalized = fieldName.toLowerCase().trim();

    if (row[fieldName] !== undefined && row[fieldName] !== null) {
        return String(row[fieldName]).trim();
    }

    const exactHeader = headers.find(h => h.toLowerCase().trim() === normalized);
    if (exactHeader && row[exactHeader] !== undefined && row[exactHeader] !== null) {
        return String(row[exactHeader]).trim();
    }

    const partialHeader = headers.find(h => {
        const normalizedHeader = h.toLowerCase().trim();
        return normalizedHeader.includes(normalized) || normalized.includes(normalizedHeader);
    });

    if (partialHeader && row[partialHeader] !== undefined && row[partialHeader] !== null) {
        return String(row[partialHeader]).trim();
    }

    return '';
}

function findColumn(row, headers, candidates) {
    for (const name of candidates) {
        const value = getFieldValue(row, headers, name);
        if (value) return value;
    }
    return '';
}

function formatText(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStatusClass(status) {
    if (!status) return 'under-review';
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
    return 'under-review';
}

function getStatusLabel(status) {
    if (!status) return 'Under Review';
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
    return 'Under Review';
}

function mapRowToProposal(row, headers) {
    const get = (names) => findColumn(row, headers, names);
    let imageUrl = get(['Image', 'image']) || '';
    imageUrl = imageUrl.trim();
    if (imageUrl.startsWith('"') && imageUrl.endsWith('"')) {
        imageUrl = imageUrl.slice(1, -1);
    }

    const statusRaw = get(['Status', 'status']);
    const statusClass = getStatusClass(statusRaw);

    return {
        title: get(['Title', 'title']) || 'Untitled Proposal',
        titleLower: (get(['Title', 'title']) || 'Untitled Proposal').toLowerCase(),
        name: get(['Name', 'name']),
        description: get(['Description', 'description']),
        technicalDetails: get(['Technical details', 'Technical Details']),
        spaceRequirements: get(['Space requirements', 'Space Requirements']),
        locationRequirements: get(['Location requirements', 'Location Requirements']),
        powerRequirements: get(['Power requirements', 'Power Requirements']),
        sound: get(['Sound', 'sound']),
        safety: get(['Safety', 'safety']),
        strike: get(['Strike', 'strike']),
        coCreation: get(['Co-creation', 'Co-creation']),
        team: get(['Team', 'team']),
        coverImage: imageUrl,
        statusLabel: getStatusLabel(statusRaw),
        statusClass,
        statusKey: statusClass,
        orderIndex: Math.random(),
    };
}

function buildDetailSections(proposal) {
    const sections = [
        { label: 'Technical Details', value: proposal.technicalDetails },
        { label: 'Space Requirements', value: proposal.spaceRequirements },
        { label: 'Location Requirements', value: proposal.locationRequirements },
        { label: 'Power Requirements', value: proposal.powerRequirements },
        { label: 'Sound', value: proposal.sound },
        { label: 'Safety', value: proposal.safety },
        { label: 'Strike', value: proposal.strike },
        { label: 'Co-creation', value: proposal.coCreation },
        { label: 'Team', value: proposal.team },
    ];

    return sections
        .filter(section => section.value)
        .map(section => `
            <div class="detail-section">
                <h3>${section.label}</h3>
                <p>${formatText(section.value)}</p>
            </div>
        `)
        .join('');
}

function createProposalCard(proposal) {
    const card = document.createElement('div');
    card.className = 'proposal-card';

    const detailSections = buildDetailSections(proposal);

    card.innerHTML = `
        <header>
            <div class="title-row">
                <h2>${escapeHtml(proposal.title)}</h2>
                <span class="status ${proposal.statusClass}">${escapeHtml(proposal.statusLabel)}</span>
            </div>
            ${proposal.name ? `<div class="author">${escapeHtml(proposal.name)}</div>` : ''}
        </header>
        <main>
            ${proposal.coverImage ? `<img class="cover-image" src="${proposal.coverImage.replace(/"/g, '&quot;')}" alt="${escapeHtml(proposal.title)}" loading="lazy" onerror="this.style.display='none'">` : ''}
            <div class="summary">${formatText(proposal.description || 'No description provided.')}</div>
            ${detailSections ? `
                <details>
                    <summary>View full details</summary>
                    <div class="details-content">
                        ${detailSections}
                    </div>
                </details>
            ` : ''}
        </main>
    `;

    return card;
}

function buildTable(list) {
    const table = document.createElement('table');
    table.className = 'proposal-table';
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Title</th>
            <th>Artist</th>
            <th>Status</th>
            <th>Details</th>
        </tr>
    `;

    const tbody = document.createElement('tbody');

    list.forEach(proposal => {
        const tr = document.createElement('tr');

        const titleTd = document.createElement('td');
        titleTd.textContent = proposal.title;

        const artistTd = document.createElement('td');
        artistTd.textContent = proposal.name || '—';

        const statusTd = document.createElement('td');
        statusTd.innerHTML = `<span class="status ${proposal.statusClass}">${escapeHtml(proposal.statusLabel)}</span>`;

        const detailsTd = document.createElement('td');
        const detailSections = buildDetailSections(proposal);
        const descriptionHTML = proposal.description ? `<p>${formatText(proposal.description)}</p>` : '';

        if (detailSections || proposal.description) {
            detailsTd.innerHTML = `
                <details class="table-details">
                    <summary>Open</summary>
                    <div>
                        ${descriptionHTML}
                        ${detailSections}
                    </div>
                </details>
            `;
        } else {
            detailsTd.textContent = '—';
        }

        tr.appendChild(titleTd);
        tr.appendChild(artistTd);
        tr.appendChild(statusTd);
        tr.appendChild(detailsTd);
        tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    return table;
}

function sortProposals(list) {
    const copy = [...list];
    if (sortMode === 'title-asc') {
        return copy.sort((a, b) => a.titleLower.localeCompare(b.titleLower));
    }
    if (sortMode === 'title-desc') {
        return copy.sort((a, b) => b.titleLower.localeCompare(a.titleLower));
    }
    return copy.sort((a, b) => a.orderIndex - b.orderIndex);
}

function applyFiltersAndRender() {
    if (!proposalData.length) return;

    const filtered = proposalData.filter(proposal => {
        const flag = statusFilters[proposal.statusKey];
        return flag === undefined ? true : flag;
    });

    filteredList = sortProposals(filtered);
    renderProposals();
}

function renderProposals() {
    const list = filteredList;
    proposalsContainer.innerHTML = '';

    proposalsContainer.classList.toggle('table-view', viewMode === 'table');

    if (!list.length) {
        proposalsContainer.innerHTML = '<div class="empty">No proposals match the selected filters.</div>';
        proposalsContainer.classList.remove('single');
        document.getElementById('loading').style.display = 'none';
        return;
    }

    if (viewMode === 'table') {
        proposalsContainer.appendChild(buildTable(list));
        proposalsContainer.classList.remove('single');
    } else {
        list.forEach(proposal => proposalsContainer.appendChild(createProposalCard(proposal)));
        proposalsContainer.classList.toggle('single', list.length === 1);
    }

    document.getElementById('loading').style.display = 'none';
}

function showError(message) {
    document.getElementById('loading').style.display = 'none';
    const errorBox = document.getElementById('error');
    errorBox.textContent = message;
    errorBox.style.display = 'block';
}

async function fetchData() {
    try {
        const response = await fetch(CSV_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }

        const csvText = await response.text();
        const data = parseCSV(csvText);
        hydrateProposals(data);
    } catch (error) {
        console.error('Error fetching data:', error);
        showError(`Error loading data: ${error.message}. Please make sure the spreadsheet is publicly accessible.`);
    }
}

function hydrateProposals(data) {
    const { headers, rows } = data;
    if (!headers.length || !rows.length) {
        renderProposals();
        return;
    }

    const completeRows = rows.filter(row => {
        const title = getFieldValue(row, headers, 'Title');
        return title && title.trim().length > 0;
    });

    if (!completeRows.length) {
        renderProposals();
        return;
    }

    proposalData = completeRows.map(row => mapRowToProposal(row, headers));
    applyFiltersAndRender();
}

fetchData();
