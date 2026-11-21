import { TFunction } from 'i18next';

/**
 * Format date to "15-January-2026" format with translated month names
 * @param dateString - Date string from API (e.g., "2026-01-15" or "15/01/2026")
 * @param t - Translation function
 * @returns Formatted date string (e.g., "15-January-2026")
 */
const ENGLISH_MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

export const formatEventDate = (dateString: string, t: TFunction): string => {
  try {
    // Parse the date string
    let date: Date;
    
    // Handle different date formats
    if (dateString.includes('-')) {
      // Format: "2026-01-15" or "15-01-2026"
      const parts = dateString.split('-');
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        date = new Date(dateString);
      } else {
        // DD-MM-YYYY
        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
    } else if (dateString.includes('/')) {
      // Format: "15/01/2026" or "2026/01/15"
      const parts = dateString.split('/');
      if (parts[0].length === 4) {
        // YYYY/MM/DD
        date = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
      } else {
        // DD/MM/YYYY
        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
    } else {
      // "25 September 2026" — the API's English 'd F Y' (race_date_formatted).
      // Read by hand: Hermes does not reliably parse month names, and the
      // client asked for the month in the app's language (2026-10-23).
      const m = dateString.trim().match(/^(\d{1,2}) ([A-Za-z]+) (\d{4})$/);
      const named = m ? ENGLISH_MONTHS.indexOf(m[2].toLowerCase()) : -1;
      date = named >= 0
        ? new Date(Number(m![3]), named, Number(m![1]))
        : new Date(dateString);   // Try to parse as is
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString; // Return original if parsing fails
    }
    
    const day = date.getDate();
    const monthIndex = date.getMonth(); // 0-11
    const year = date.getFullYear();
    
    // Month names array for translation keys
    const monthKeys = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    
    const monthName = t(`common:months.${monthKeys[monthIndex]}`);
    
    // Format: "15-January-2026"
    return `${day} ${monthName} ${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString; // Return original if error
  }
};