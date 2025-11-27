import { CSV_URL, PLACEHOLDER_IMAGE } from './constants.js';
import { parseCSV, findColumn, generateSlug } from './utils.js';

export async function fetchSpreadsheetData() {
  const response = await fetch(CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
  }
  const csvText = await response.text();
  return parseCSV(csvText);
}

export function mapRowToProposal(row, headers) {
  const title = findColumn(row, headers, ['Title', 'title']) || 'Untitled Proposal';
  let imageUrl = findColumn(row, headers, ['Image', 'image']) || '';
  imageUrl = imageUrl.trim();

  if (!imageUrl) {
    imageUrl = PLACEHOLDER_IMAGE;
  }

  const status = findColumn(row, headers, ['Status', 'status']);

  return {
    title,
    titleLower: title.toLowerCase(),
    slug: generateSlug(title),
    name: findColumn(row, headers, ['Name', 'name']),
    description: findColumn(row, headers, ['Description', 'description']),
    technicalDetails: findColumn(row, headers, ['Technical details', 'Technical Details']),
    spaceRequirements: findColumn(row, headers, ['Space requirements', 'Space Requirements']),
    locationRequirements: findColumn(
      row,
      headers,
      ['Location requirements', 'Location Requirements']
    ),
    powerRequirements: findColumn(row, headers, ['Power requirements', 'Power Requirements']),
    sound: findColumn(row, headers, ['Sound', 'sound']),
    safety: findColumn(row, headers, ['Safety', 'safety']),
    strike: findColumn(row, headers, ['Strike', 'strike']),
    coCreation: findColumn(row, headers, ['Co-creation', 'Co-creation']),
    team: findColumn(row, headers, ['Team', 'team']),
    budget: findColumn(row, headers, ['Budget', 'budget']),
    coverImage: imageUrl,
    statusLabel: formatStatusLabel(status),
    statusClass: formatStatusClass(status),
    statusKey: formatStatusClass(status),
    orderIndex: Math.random(),
  };
}

function formatStatusClass(status) {
  if (!status) return 'under-review';
  const normalized = status.toLowerCase();
  if (normalized.includes('funded') && !normalized.includes('not')) return 'funded';
  if (normalized.includes('not') && normalized.includes('funded')) return 'not-funded';
  if (normalized.includes('review') || normalized.includes('under')) return 'under-review';
  return 'under-review';
}

function formatStatusLabel(status) {
  if (!status) return 'Under Review';
  const normalized = status.toLowerCase();
  if (normalized.includes('funded') && !normalized.includes('not')) return 'Funded';
  if (normalized.includes('not') && normalized.includes('funded')) return 'Not Funded';
  if (normalized.includes('review') || normalized.includes('under')) return 'Under Review';
  return 'Under Review';
}



