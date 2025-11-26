import { statusFilters, state } from './state.js';
import { fetchSpreadsheetData, mapRowToProposal } from './data.js';
import { escapeHtml, formatText, getDisplayName } from './utils.js';

const CARD_STAGGER_MS = 80;

let proposalsContainer;
let loadingEl;
let errorEl;
let sortSelect;
let viewButtons;
let statusButtons;
let proposalCountEl;
let searchInput;

export function initUI() {
  proposalsContainer = document.getElementById('proposals-list');
  loadingEl = document.getElementById('loading');
  errorEl = document.getElementById('error');
  sortSelect = document.getElementById('sort-select');
  viewButtons = [...document.querySelectorAll('.view-button')];
  statusButtons = [...document.querySelectorAll('.status-chip')];
  proposalCountEl = document.getElementById('proposal-count');
  searchInput = document.getElementById('search-input');

  attachEventListeners();
  loadData();
}

function attachEventListeners() {
  statusButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const status = button.dataset.status;
      statusFilters[status] = !statusFilters[status];
      button.classList.toggle('is-active', statusFilters[status]);
      button.setAttribute('aria-pressed', String(statusFilters[status]));
      applyFiltersAndRender();
    });
  });

  sortSelect.addEventListener('change', (event) => {
    state.sortMode = event.target.value;
    applyFiltersAndRender();
  });

  viewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextView = button.dataset.view;
      if (nextView === state.viewMode) return;
      state.viewMode = nextView;
      viewButtons.forEach((btn) => {
        const isActive = btn.dataset.view === state.viewMode;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
      });
      renderProposals();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      state.searchQuery = event.target.value.trim().toLowerCase();
      applyFiltersAndRender();
    });
  }

  window.addEventListener('hashchange', () => {
    if (state.suppressHashChange) return;
    const hash = window.location.hash.slice(1);
    if (hash) {
      const proposal = state.proposalData.find((item) => item.slug === hash);
      if (proposal) {
        openProposalModal(proposal);
      }
    }
  });
}

async function loadData() {
  try {
    showLoading(true);
    const { headers, rows } = await fetchSpreadsheetData();
    if (!rows.length) {
      showError('No proposals available.');
      return;
    }

    state.proposalData = rows.map((row) => mapRowToProposal(row, headers));
    updateProposalCount(state.proposalData.length);
    applyFiltersAndRender();

    if (window.location.hash) {
      const hash = window.location.hash.slice(1);
      const initialProposal = state.proposalData.find((item) => item.slug === hash);
      if (initialProposal) {
        openProposalModal(initialProposal);
      }
    }
  } catch (error) {
    console.error(error);
    showError(error.message);
    updateProposalCount(0);
  } finally {
    showLoading(false);
  }
}

function applyFiltersAndRender() {
  if (!state.proposalData.length) return;
  const filtered = state.proposalData.filter((proposal) => {
    // Status filter
    const statusMatch = statusFilters[proposal.statusKey] !== false;
    
    // Search filter
    let searchMatch = true;
    if (state.searchQuery) {
      const query = state.searchQuery;
      const searchableText = [
        proposal.title || '',
        proposal.name || '',
        proposal.description || '',
        proposal.technicalDetails || '',
        proposal.spaceRequirements || '',
        proposal.locationRequirements || '',
        proposal.team || '',
      ]
        .join(' ')
        .toLowerCase();
      searchMatch = searchableText.includes(query);
    }
    
    return statusMatch && searchMatch;
  });

  state.filteredList = sortProposals(filtered);
  updateProposalCount(state.filteredList.length);
  renderProposals();
}

function sortProposals(list) {
  const copy = [...list];
  if (state.sortMode === 'title-asc') {
    return copy.sort((a, b) => a.titleLower.localeCompare(b.titleLower));
  }
  if (state.sortMode === 'title-desc') {
    return copy.sort((a, b) => b.titleLower.localeCompare(a.titleLower));
  }
  if (state.sortMode === 'status') {
    const order = {
      funded: 0,
      'under-review': 1,
      'not-funded': 2,
    };
    return copy.sort(
      (a, b) =>
        (order[a.statusClass] ?? 99) - (order[b.statusClass] ?? 99) ||
        a.titleLower.localeCompare(b.titleLower)
    );
  }
  return copy.sort((a, b) => a.orderIndex - b.orderIndex);
}

function renderProposals() {
  proposalsContainer.innerHTML = '';
  const list = state.filteredList;

  if (!list.length) {
    proposalsContainer.innerHTML = '<div class="empty">No proposals match the selected filters.</div>';
    return;
  }

  if (state.viewMode === 'table') {
    proposalsContainer.classList.remove('single');
    proposalsContainer.appendChild(buildTable(list));
    return;
  }

  list.forEach((proposal, index) => {
    const card = createProposalCard(proposal);
    card.classList.add('card-clickable');
    card.addEventListener('click', () => openProposalModal(proposal));
    card.style.setProperty('--card-delay', `${index * CARD_STAGGER_MS}ms`);
    proposalsContainer.appendChild(card);
  });
  proposalsContainer.classList.toggle('single', list.length === 1);
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
    .filter((section) => section.value)
    .map(
      (section) => `
        <div class="detail-section">
          <h3>${section.label}</h3>
          <p>${formatText(section.value)}</p>
        </div>
      `
    )
    .join('');
}

function createProposalCard(
  proposal,
  { showAllDetails = false, showStatusText = false, showHeader = true } = {}
) {
  const card = document.createElement('article');
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
  const statusHTML = showStatusText
    ? `<span class="status ${proposal.statusClass}">${escapeHtml(proposal.statusLabel)}</span>`
    : '';
  const cardStatusHTML = showStatusText
    ? `<div class="card-status"><span class="status ${proposal.statusClass}">${escapeHtml(
        proposal.statusLabel
      )}</span></div>`
    : '';

  const authorMarkup = !showAllDetails && showHeader ? formatAuthor(proposal) : '';
  const headerHTML = showHeader
    ? `
        <header>
            <div class="title-row">
                <h2>${escapeHtml(proposal.title)}</h2>
                ${statusHTML}
            </div>
            ${authorMarkup}
        </header>
    `
    : '';

  card.innerHTML = `
        ${headerHTML}
        <main>
            ${proposal.coverImage ? `<img class="cover-image" src="${proposal.coverImage}" alt="${escapeHtml(proposal.title)}" loading="lazy">` : ''}
            <div class="summary">${formatText(proposal.description || 'No description provided.')}</div>
            ${detailsHTML}
        </main>
        ${cardStatusHTML}
    `;

  return card;
}

function buildTable(list) {
  const wrapper = document.createElement('div');
  wrapper.className = 'table-shell';

  const table = document.createElement('table');
  table.className = 'proposal-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `
        <tr>
            <th>Title</th>
            <th>Description</th>
            <th>Status</th>
        </tr>
    `;

  const tbody = document.createElement('tbody');
  list.forEach((proposal) => {
    const tr = document.createElement('tr');
    tr.classList.add('table-row-clickable');

    const titleTd = document.createElement('td');
    titleTd.textContent = proposal.title;

    const descriptionTd = document.createElement('td');
    descriptionTd.className = 'description-cell';
    const summaryText = (proposal.description || '').replace(/\s+/g, ' ').trim();
    descriptionTd.textContent = summaryText || '—';
    if (summaryText) {
      descriptionTd.title = summaryText;
    }

    const statusTd = document.createElement('td');
    statusTd.innerHTML = `<span class="status ${proposal.statusClass}">${escapeHtml(
      proposal.statusLabel
    )}</span>`;

    tr.append(titleTd, descriptionTd, statusTd);
    tr.addEventListener('click', () => openProposalModal(proposal));
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  wrapper.appendChild(table);
  return wrapper;
}

function formatAuthor(proposal) {
  const displayName = getDisplayName(proposal);
  return displayName ? `<div class="author">${escapeHtml(displayName)}</div>` : '';
}

function openProposalModal(proposal) {
  const modal = document.createElement('div');
  modal.className = 'proposal-modal';

  const navList = (state.filteredList.length ? state.filteredList : state.proposalData) || [];
  let currentIndex = navList.findIndex((item) => item.slug === proposal.slug);
  if (currentIndex === -1 && state.proposalData.length) {
    currentIndex = state.proposalData.findIndex((item) => item.slug === proposal.slug);
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const content = document.createElement('div');
  content.className = 'modal-content';
  content.classList.add(`modal-status-${proposal.statusClass}`);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '×';

  const card = createProposalCard(proposal, {
    showAllDetails: true,
    showStatusText: false,
    showHeader: false,
  });

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
  modalArtist.textContent = getDisplayName(proposal);
  modalBarCenter.appendChild(modalTitle);
  if (getDisplayName(proposal)) {
    modalBarCenter.appendChild(modalArtist);
  }

  const modalBarRight = document.createElement('div');
  modalBarRight.className = 'modal-bar-right';
  modalBarRight.appendChild(closeBtn);
  modalBar.append(modalBarLeft, modalBarCenter, modalBarRight);

  content.appendChild(modalBar);
  content.appendChild(card);
  modal.append(backdrop, content);

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  state.suppressHashChange = true;
  window.location.hash = proposal.slug;
  setTimeout(() => {
    state.suppressHashChange = false;
  }, 0);
  window.scrollTo(0, 0);

  const closeModal = (skipHashReset = false) => {
    if (document.body.contains(modal)) {
      document.body.removeChild(modal);
    }
    document.body.style.overflow = '';
    if (!skipHashReset && window.location.hash === `#${proposal.slug}`) {
      state.suppressHashChange = true;
      window.history.replaceState(null, '', window.location.pathname);
      setTimeout(() => {
        state.suppressHashChange = false;
      }, 0);
    }
    resetViewButtons('cards');
  };

  const navigateTo = (offset) => {
    if (!navList.length || currentIndex === -1) return;
    currentIndex = (currentIndex + offset + navList.length) % navList.length;
    const nextProposal = navList[currentIndex];
    closeModal(true);
    openProposalModal(nextProposal);
  };

  if (navList.length > 1 && currentIndex !== -1) {
    const pagination = document.createElement('span');
    pagination.className = 'modal-pagination';
    pagination.textContent = `${currentIndex + 1} / ${navList.length}`;

    const navRow = document.createElement('div');
    navRow.className = 'modal-nav-row';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'modal-nav modal-nav-prev';
    prevBtn.setAttribute('aria-label', 'Previous proposal');
    prevBtn.textContent = '‹';
    prevBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      navigateTo(-1);
    });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'modal-nav modal-nav-next';
    nextBtn.setAttribute('aria-label', 'Next proposal');
    nextBtn.textContent = '›';
    nextBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      navigateTo(1);
    });

    navRow.append(prevBtn, pagination, nextBtn);
    modalBarLeft.append(navRow);
  }

  backdrop.addEventListener('click', () => closeModal());
  closeBtn.addEventListener('click', () => closeModal());
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
  modal.addEventListener('click', (event) => {
    if (!content.contains(event.target) && !event.target.closest('.modal-nav')) {
      closeModal();
    }
  });

  closeBtn.focus();
}

function resetViewButtons(view) {
  state.viewMode = view;
  viewButtons.forEach((btn) => {
    const isActive = btn.dataset.view === view;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
  renderProposals();
}

function showLoading(isLoading) {
  if (loadingEl) {
    loadingEl.style.display = isLoading ? 'block' : 'none';
  }
}

function showError(message) {
  if (loadingEl) loadingEl.style.display = 'none';
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function updateProposalCount(count) {
  if (!proposalCountEl) return;
  proposalCountEl.textContent = typeof count === 'number' ? count : '0';
}

