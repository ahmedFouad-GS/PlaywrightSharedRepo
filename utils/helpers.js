const { step } = require('allure-js-commons');
const { parse, differenceInMinutes } = require('date-fns');

class Helper {

  /**
   * This method selects a date from a calendar widget on the page. It takes the day, month, and year as parameters and navigates through the calendar to find and click the correct date.
   * @param {object} page - Playwright page object representing the browser page.
   * @param {number} day - The day of the month to select (1-31).
   * @param {number} month - The month to select (1-12).
   * @param {number} year - The year to select (e.g., 2024).
   */
  static async selectDateFromCalendar(page, day, month, year) {
    await step('Select Date From Calendar', async () => {
      let displayedYearMonth = await page.locator('.gs-datepicker-title .gs-datepicker-month').textContent();
      let displayedYear = await page.locator('.gs-datepicker-title .gs-datepicker-year').textContent();
      let currentDate = new Date(displayedYearMonth + ' 1, ' + displayedYear);
      const targetDate = new Date(year, month - 1);

      while (currentDate.getFullYear() !== targetDate.getFullYear() || currentDate.getMonth() !== targetDate.getMonth()) {
        if (targetDate > currentDate) await page.locator('.gs-datepicker-next').click();
        else await page.locator('.gs-datepicker-prev').click();
        displayedYearMonth = await page.locator('.gs-datepicker-title .gs-datepicker-month').textContent();
        displayedYear = await page.locator('.gs-datepicker-title .gs-datepicker-year').textContent();
        currentDate = new Date(displayedYearMonth + ' 1, ' + displayedYear);
      }
      const dayLocator = page.locator(`.gs-datepicker-calendar .gs-ripple >> text="${day}"`);
      const days = await dayLocator.elementHandles();
      for (const dayElement of days) {
        if (await dayElement.isVisible() && !(await dayElement.evaluate(el => el.classList.contains('gs-disabled')))) {
          await dayElement.click();
          return;
        }
      }
    });
  }
  /// Returns current time in HH:MM:00 24 hour format
  static getCurrentTime24H() {
    const currentTime = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return `${currentTime}:00`;
  }
  //add hours to time in HH:MM:00 24 hour format and return new time in same format
  static addHoursToTime24H(time, hoursToAdd) {
    const [hours, minutes] = time.split(':').map(Number);
    const newHours = (hours + hoursToAdd) % 24;
    return `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  }
  /** Returns today's date in DD/MM/YYYY format */
  static todayDDMMYYYY() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  }
  /** this method takes date in iso format and return DD/MM/YYYY format
   * @param {string} isoDate - date in iso format (e.g., "2024-06-30T12:00:00Z")
   * @returns {string} date in DD/MM/YYYY format
   */
  static convertIsoToDDMMYYYY(isoDate) {
    const date = new Date(isoDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // convert iso date to 21 January format
  static convertIsoToDDMMM(isoDate) {
    const date = new Date(isoDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('default', { month: 'long' });
    return `${day} ${month}`;
  }

  /**
   * This method takes a date in iso format and returns it in DD MMM YYYY format
   * @param {string} isoDate - date in iso format (e.g., "2024-06-30T12:00:00Z")
   * @returns {string} date in DD MMM YYYY format (e.g., "30 Jun 2024")
   */
  static convertIsoToDDMMMYYYY(isoDate) {
    const date = new Date(isoDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }

  /**
 * This method takes a date in DD/MM/YYYY format and converts it to ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
 * @param {string} dateStr - date in DD/MM/YYYY format (e.g., "30/06/2024")
 * @returns {string} date in ISO format (e.g., "2024-06-30T00:00:00.000Z")
 */
  static convertDDMMYYYYToIso(dateStr) {
    const [day, month, year] = dateStr.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toISOString();
  }

  /** this method takes a date and adds specified number of days to it, then returns the new date in iso format
   * @param {string} inputDate - date in iso format 
   * @param {number} daysToAdd - number of days to add
   * @returns {string} new date in iso format
   */
  static addDaysToIsoDate(inputDate, daysToAdd) {
    const date = new Date(inputDate);
    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString();
  }
  /** Returns today's date in DD MMM YYYY, hh:mm AM/PM format */
  static todayDDMMMYYYYhhmmAMPM() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = now.toLocaleString('default', { month: 'short' });
    const year = now.getFullYear();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const modifier = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day} ${month} ${year}, ${String(hours).padStart(2, '0')}:${minutes} ${modifier}`;
  }

  /** this method takes string time in format HH:MM AM/PM and converts it to HH:MM:00 format
   * For example, "02:30 PM" will be converted to "14:30:00"
   * @param {string} time - time in format HH:MM AM/PM
   * @returns {string} time in format HH:MM:00
   */
  static convertTimeTo24HourFormat(time) {
    const [timePart, modifier] = time.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  }
  /** this method takes time in format HH:MM:SS and adds 3 hours to it, then returns time in format HH:MM AM/PM
   * @param {string} time - time in format HH:MM:SS
   * @returns {string} time in format HH:MM AM/PM
   */
  static addThreeHoursAndConvertTo12HourFormat(time) {
    let [hours, minutes, seconds] = time.split(':').map(Number);
    hours = (hours + 3) % 24;
    const modifier = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${modifier}`;
  }

  /**
   * This method takes time in format HH:MM AM/PM and removes leading zeros from hours, returns time in format H:MM AM/PM
   * @param {string} time - time in format HH:MM AM/PM
   * @returns {string} time in format H:MM AM/PM
   */
  static removeLeadingZeroFromHours(time) {
    const [timePart, modifier] = time.split(' ');
    let [hours, minutes] = timePart.split(':');
    hours = String(Number(hours));
    return `${hours}:${minutes} ${modifier}`;
  }

  /**
   * This method takes time in format HH:MM:SS and subtracts 3 hours from it, then returns the new time in the same format
   * @param {string} time - time in format HH:MM:SS
   * @returns {string} time in format HH:MM:SS
   */
  static subtractThreeHours(time) {
    let [hours, minutes, seconds] = time.split(':').map(Number);
    hours -= 3;
    if (hours < 0) hours += 24;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * This method checks if two dates are within a specified tolerance in minutes
   * @param {string} actualDate - the actual date in format 'dd MMM yyyy, hh:mm a'
   * @param {string} expectedDate - the expected date in format 'dd MMM yyyy, hh:mm a'
   * @param {number} toleranceInMinutes - the tolerance in minutes
   * @returns {boolean} - true if the dates are within the tolerance, false otherwise
   */
  static areDatesWithinTolerance(actualDate, expectedDate, toleranceInMinutes = 3) {
    const format = 'dd MMM yyyy, hh:mm a';
    const actual = parse(actualDate, format, new Date());
    const expected = parse(expectedDate, format, new Date());
    return Math.abs(differenceInMinutes(actual, expected)) <= toleranceInMinutes;
  }
  static getMimeType(filePath) {
    const extension = filePath.split('.').pop().toLowerCase();
    const mimeTypes = {
      'jpeg': 'image/jpeg',
      'jpg': 'image/jpeg',
      'png': 'image/png',
      'pdf': 'application/pdf',
      // add more extensions and their MIME types as needed
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }


}

module.exports = Helper;