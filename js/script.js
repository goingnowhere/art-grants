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
let suppressHashChange = false;

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

function generateSlug(title) {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function mapRowToProposal(row, headers) {
    const get = (names) => findColumn(row, headers, names);
    let imageUrl = get(['Image', 'image']) || '';
    imageUrl = imageUrl.trim();
    if (imageUrl.startsWith('"') && imageUrl.endsWith('"')) {
        imageUrl = imageUrl.slice(1, -1);
    }
    const hasImage = !!imageUrl;
    if (!hasImage) {
        imageUrl = 'https://placehold.co/600x400/CCCCCC/000000?text=Image+Coming+Soon';
    }

    const statusRaw = get(['Status', 'status']);
    const statusClass = getStatusClass(statusRaw);
    const title = get(['Title', 'title']) || 'Untitled Proposal';

    return {
        title,
        titleLower: title.toLowerCase(),
        slug: generateSlug(title),
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
        hasImage,
        statusLabel: getStatusLabel(statusRaw),
        statusClass,
        statusKey: statusClass,
        orderIndex: Math.random(),
    };
}

function getDisplayName(proposal) {
    return proposal.name || '';
}

function formatAuthor(proposal) {
    const displayName = getDisplayName(proposal);
    return displayName ? `<div class="author">${escapeHtml(displayName)}</div>` : '';
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
        { label: 'Budget', value: proposal.budget },
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

function createProposalCard(proposal, showAllDetails = false, showStatusText = false) {
    const card = document.createElement('div');
    card.className = 'proposal-card';
    if (showAllDetails) {
        card.classList.add('modal-view');
    }

    const detailSections = buildDetailSections(proposal);

    const detailsHTML = showAllDetails && detailSections ? `
        <div class="details-content">
            ${detailSections}
        </div>
    ` : '';

    card.dataset.status = proposal.statusClass;
    card.dataset.slug = proposal.slug;
    const statusHTML = showStatusText ? `<span class="status ${proposal.statusClass}">${escapeHtml(proposal.statusLabel)}</span>` : '';
    const permalink = `${window.location.origin}${window.location.pathname}#${proposal.slug}`;
    const permalinkHTML = !showStatusText ? `<button class="permalink-btn" data-permalink="${permalink}" aria-label="Copy permalink" title="Copy permalink">🔗</button>` : '';
    const showCardStatus = !showAllDetails && !showStatusText;
    const cardStatusHTML = showCardStatus ? `<div class="card-status"><span class="status ${proposal.statusClass}">${escapeHtml(proposal.statusLabel)}</span>${permalinkHTML}</div>` : '';
    
    card.innerHTML = `
        <header>
            ${!showAllDetails ? `
                <div class="title-row">
                    <h2>${escapeHtml(proposal.title)}</h2>
                    ${statusHTML}
                </div>
                ${formatAuthor(proposal)}
            ` : ''}
        </header>
        <main>
            ${proposal.coverImage ? `<img class="cover-image" src="${proposal.coverImage.replace(/"/g, '&quot;')}" alt="${escapeHtml(proposal.title)}" loading="lazy" onerror="this.style.display='none'">` : ''}
            <div class="summary">${formatText(proposal.description || 'No description provided.')}</div>
            ${detailsHTML}
        </main>
        ${cardStatusHTML}
    `;

    const permalinkBtn = card.querySelector('.permalink-btn');
    if (permalinkBtn) {
        permalinkBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const url = permalinkBtn.dataset.permalink;
            navigator.clipboard.writeText(url).then(() => {
                const originalText = permalinkBtn.textContent;
                permalinkBtn.textContent = '✓';
                setTimeout(() => {
                    permalinkBtn.textContent = originalText;
                }, 1000);
            });
        });
    }

    return card;
}

function buildTable(list) {
    const table = document.createElement('table');
    table.className = 'proposal-table';
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Title</th>
            <th>Status</th>
        </tr>
    `;

    const tbody = document.createElement('tbody');

    list.forEach(proposal => {
        const tr = document.createElement('tr');
        tr.classList.add('table-row-clickable');
        tr.dataset.proposalIndex = list.indexOf(proposal);

        const titleTd = document.createElement('td');
        titleTd.textContent = proposal.title;

        const statusTd = document.createElement('td');
        statusTd.innerHTML = `<span class="status ${proposal.statusClass}">${escapeHtml(proposal.statusLabel)}</span>`;

        tr.appendChild(titleTd);
        tr.appendChild(statusTd);
        tbody.appendChild(tr);

        tr.addEventListener('click', () => openProposalModal(proposal));
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    return table;
}

function openProposalModal(proposal) {
    const navList = (filteredList && filteredList.length ? filteredList : proposalData) || [];
    let currentIndex = navList.findIndex((item) => item.slug === proposal.slug);
    if (currentIndex === -1 && proposalData.length) {
        currentIndex = proposalData.findIndex((item) => item.slug === proposal.slug);
    }

    const modal = document.createElement('div');
    modal.className = 'proposal-modal';
    
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    
    const content = document.createElement('div');
    content.className = 'modal-content';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';
    
    const card = createProposalCard(proposal, true, false);
    
    const modalBar = document.createElement('div');
    modalBar.className = 'modal-bar';
    
    const modalBarLeft = document.createElement('div');
    modalBarLeft.className = 'modal-bar-left';
    
    const modalBarCenter = document.createElement('div');
    modalBarCenter.className = 'modal-bar-center';
    const modalTitle = document.createElement('h2');
    modalTitle.textContent = proposal.title || 'Untitled Proposal';
    const modalArtist = document.createElement('p');
    modalArtist.className = 'modal-bar-artist';
    modalArtist.textContent = getDisplayName(proposal) || '';
    modalBarCenter.appendChild(modalTitle);
    if (getDisplayName(proposal)) {
        modalBarCenter.appendChild(modalArtist);
    }
    
    const modalBarRight = document.createElement('div');
    modalBarRight.className = 'modal-bar-right';
    const statusBadge = document.createElement('span');
    statusBadge.className = `status ${proposal.statusClass}`;
    statusBadge.textContent = proposal.statusLabel;
    
    const modalLinkBtn = document.createElement('button');
    modalLinkBtn.className = 'modal-bar-link';
    modalLinkBtn.setAttribute('aria-label', 'Copy project link');
    modalLinkBtn.textContent = '🔗';
    modalLinkBtn.addEventListener('click', () => {
        const url = `${window.location.origin}${window.location.pathname}#${proposal.slug}`;
        navigator.clipboard.writeText(url).then(() => {
            modalLinkBtn.textContent = '✓';
            setTimeout(() => {
                modalLinkBtn.textContent = '🔗';
            }, 1000);
        });
    });
    
    modalBarRight.append(statusBadge, modalLinkBtn, closeBtn);
    modalBar.append(modalBarLeft, modalBarCenter, modalBarRight);
    
    content.appendChild(modalBar);
    content.appendChild(card);
    modal.appendChild(backdrop);
    modal.appendChild(content);
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    suppressHashChange = true;
    window.location.hash = proposal.slug;
    setTimeout(() => {
        suppressHashChange = false;
    }, 0);
    window.scrollTo(0, 0);

    const closeModal = (skipHashReset = false) => {
        if (document.body.contains(modal)) {
            document.body.removeChild(modal);
        }
        document.body.style.overflow = '';
        if (!skipHashReset && window.location.hash === `#${proposal.slug}`) {
            suppressHashChange = true;
            window.history.replaceState(null, '', window.location.pathname);
            setTimeout(() => {
                suppressHashChange = false;
            }, 0);
        }
        if (!skipHashReset) {
            viewMode = 'cards';
            viewButtons.forEach((btn) => {
                const isActive = btn.dataset.view === viewMode;
                btn.classList.toggle('is-active', isActive);
                btn.setAttribute('aria-pressed', String(isActive));
            });
            renderProposals();
        }
    };

    const navigateTo = (offset) => {
        if (!navList.length || currentIndex === -1) return;
        currentIndex = (currentIndex + offset + navList.length) % navList.length;
        const nextProposal = navList[currentIndex];
        closeModal(true);
        openProposalModal(nextProposal);
    };

    if (navList.length > 1 && currentIndex !== -1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'modal-nav modal-nav-prev';
        prevBtn.setAttribute('aria-label', 'Previous proposal');
        prevBtn.textContent = '‹';
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateTo(-1);
        });

        const pagination = document.createElement('span');
        pagination.className = 'modal-pagination';
        pagination.textContent = `${currentIndex + 1} / ${navList.length}`;

        const nextBtn = document.createElement('button');
        nextBtn.className = 'modal-nav modal-nav-next';
        nextBtn.setAttribute('aria-label', 'Next proposal');
        nextBtn.textContent = '›';
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateTo(1);
        });

        modalBarLeft.append(prevBtn);
        modalBarLeft.append(pagination);
        modalBarLeft.append(nextBtn);
    }

    backdrop.addEventListener('click', () => closeModal());
    closeBtn.addEventListener('click', () => closeModal());
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
    modal.addEventListener('click', (e) => {
        if (!content.contains(e.target) && !e.target.closest('.modal-nav')) {
            closeModal();
        }
    });
    
    closeBtn.focus();
}

function openProposalBySlug(slug) {
    const proposal = proposalData.find(p => p.slug === slug);
    if (proposal) {
        openProposalModal(proposal);
    }
}

function handleHashChange() {
    if (suppressHashChange) return;
    const hash = window.location.hash.slice(1);
    if (hash) {
        openProposalBySlug(hash);
    }
}

function sortProposals(list) {
    const copy = [...list];
    if (sortMode === 'title-asc') {
        return copy.sort((a, b) => a.titleLower.localeCompare(b.titleLower));
    }
    if (sortMode === 'title-desc') {
        return copy.sort((a, b) => b.titleLower.localeCompare(a.titleLower));
    }
    if (sortMode === 'status') {
        const order = {
            'funded': 0,
            'under-review': 1,
            'not-funded': 2,
        };
        return copy.sort((a, b) => (order[a.statusClass] ?? 99) - (order[b.statusClass] ?? 99) || a.titleLower.localeCompare(b.titleLower));
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
        list.forEach(proposal => {
            const card = createProposalCard(proposal);
            card.classList.add('card-clickable');
            card.addEventListener('click', (e) => {
                // Don't open modal if clicking on interactive elements
                if (e.target.closest('details, summary, a, button')) {
                    return;
                }
                openProposalModal(proposal);
            });
            proposalsContainer.appendChild(card);
        });
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
    
    // Check hash after data is loaded
    if (window.location.hash) {
        handleHashChange();
    }
}

window.addEventListener('hashchange', handleHashChange);

fetchData();
