export const MAX_IMAGE_DATA_URL_SIZE = 2 * 1024 * 1024;

export const validateImageDataUrl = (value, fieldName = "image") => {
  if (value === "" || value === null || value === undefined) return true;
  if (!value.startsWith("data:image/")) {
    throw new Error(`${fieldName} must be a base64 data URL`);
  }
  if (value.length > MAX_IMAGE_DATA_URL_SIZE) {
    throw new Error(`${fieldName} must be under 2MB`);
  }
  return true;
};

export const RESIDENT_PROFILE_FIELDS =
  "name phone userId cnic profileImage cnicFront cnicBack emergencyNumber fatherName fatherPhone";
