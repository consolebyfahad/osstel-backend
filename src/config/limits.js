/** Shared input limits — keep mobile `src/constants/limits.ts` in sync. */
export const LIMITS = {
  PASSWORD_MIN: 6,
  /** Bcrypt only uses the first 72 bytes; reject longer passwords early. */
  PASSWORD_MAX: 72,
  NAME_MAX: 80,
  ADDRESS_MAX: 200,
  CITY_MAX: 50,
  HOSTEL_NAME_MAX: 100,
  ROOM_NUMBER_MAX: 20,
  ROOM_CAPACITY_MIN: 1,
  ROOM_CAPACITY_MAX: 5,
  RENT_MAX: 9_999_999,
  PHONE_MIN_DIGITS: 10,
  PHONE_MAX_DIGITS: 15,
  USER_ID_MIN: 4,
  USER_ID_MAX: 20,
  NOTE_MAX: 300,
  SUBJECT_MAX: 120,
  MESSAGE_MAX: 2000,
  COMPLAINT_TITLE_MAX: 100,
  COMPLAINT_DESCRIPTION_MAX: 1000,
  EXPENSE_TITLE_MAX: 100,
  EXPENSE_DETAILS_MAX: 500,
  EMAIL_MAX: 254,
  CNIC_PATTERN: /^[0-9]{5}-[0-9]{7}-[0-9]$/,
  ADD_HOSTEL_CITIES: ["Lahore", "Islamabad", "Faisalabad", "Multan"],
};

export const passwordLengthMessage = `Password must be ${LIMITS.PASSWORD_MIN}-${LIMITS.PASSWORD_MAX} characters`;
