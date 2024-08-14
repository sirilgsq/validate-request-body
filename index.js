const HTTP_STATUS_OK = 200;
const HTTP_STATUS_BAD_REQUEST = 400;

/**
 * Middleware to validate the request body based on provided validation rules.
 * @param {Array} rules - Array of validation rules.
 * @returns {Function} Express middleware function.
 *
 * Each rule in the rules array should be an object with the following properties:
 *   - {string} key - The key to validate in the request body.
 *   - {string} type - The expected data type (e.g., "string", "number", "boolean", "array", "object", "email","custom-regex","custom-function").
 *   - {boolean} [required=false] - Whether the key is required in the request body.
 *   - {number} [min] - The minimum length (for strings/arrays) or value (for numbers).
 *   - {number} [max] - The maximum length (for strings/arrays) or value (for numbers).
 *   - {RegExp} [regex] - A regular expression the value must match (for strings).
 *   - {Function} [customValidator] - A custom validation function that should return an error message if validation fails.
 */
const validateRequestBody = (rules) => {
  return (req, res, next) => {
    const errors = [];
    const validatedData = {};

    rules.forEach((rule) => {
      const {
        key,
        type,
        required = false,
        min,
        max,
        regex,
        customValidator,
      } = rule;
      const value = req.body[key];

      // Check for required fields
      if (required && !isPresent(value)) {
        errors.push(`${key} is required`);
        return;
      }

      // Skip further validation if the value is not present
      if (!isPresent(value)) return;

      // Type validation
      if (!validateType(key, value, type, errors)) return;

      // Further validations for strings, arrays, and custom rules
      validateValue(
        key,
        value,
        type,
        { min, max, regex, customValidator },
        errors,
        validatedData
      );
    });

    if (errors.length > 0) {
      return res.status(HTTP_STATUS_OK).json({
        status: HTTP_STATUS_BAD_REQUEST,
        message: errors,
      });
    }

    // Replace req.body with validated data
    req.body = validatedData;
    next();
  };
};

module.exports = validateRequestBody;

/**
 * Check if the value is present (not undefined, null, or an empty string).
 * @param {*} value - The value to check.
 * @returns {boolean} - True if the value is present, false otherwise.
 */
const isPresent = (value) =>
  value !== undefined && value !== null && value !== "";

/**
 * Validate the type of the value.
 * @param {string} key - The key being validated.
 * @param {*} value - The value to validate.
 * @param {string} type - The expected type of the value.
 * @param {Array} errors - The array to push error messages to.
 * @returns {boolean} - True if the type is valid, false otherwise.
 */
const validateType = (key, value, type, errors) => {
  const typeValidators = {
    string: (val) => typeof val === "string",
    number: (val) => typeof val === "number",
    boolean: (val) => typeof val === "boolean",
    array: (val) => Array.isArray(val),
    object: (val) => typeof val === "object" && !Array.isArray(val),
    email: (val) =>
      typeof val === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    "custom-regex": () => true,
    "custom-function": () => true,
  };

  if (!typeValidators[type]?.(value)) {
    errors.push(`${key} should be a valid ${type}`);
    return false;
  }

  return true;
};

/**
 * Validate the value based on additional constraints such as min, max, regex, and custom validators.
 * @param {string} key - The key being validated.
 * @param {*} value - The value to validate.
 * @param {string} type - The type of the value.
 * @param {Object} constraints - Additional validation constraints.
 * @param {Array} constraints.min - Minimum length/size for strings/arrays or minimum value for numbers.
 * @param {Array} constraints.max - Maximum length/size for strings/arrays or maximum value for numbers.
 * @param {RegExp} constraints.regex - Regular expression for strings.
 * @param {Function} constraints.customValidator - Custom validation function.
 * @param {Array} errors - The array to push error messages to.
 * @param {Object} validatedData - The object to store validated data.
 */
const validateValue = (
  key,
  value,
  type,
  { min, max, regex, customValidator },

  errors,
  validatedData
) => {
  // Length/size validations for strings and arrays
  if (
    (type === "string" || type === "array") &&
    min !== undefined &&
    value.length < min
  ) {
    const message =
      type === "string"
        ? `${key} should have at least ${min} characters`
        : ` ${key} should have at least ${min} items`;
    errors.push(message);
  }

  if (
    (type === "string" || type === "array") &&
    max !== undefined &&
    value.length > max
  ) {
    const message =
      type === "string"
        ? `${key} should have at most ${max} characters`
        : `${key} should have at most ${max} items;`;
    errors.push(message);
  }

  // Regex validation for strings
  if (type == "custom-regex" && regex && !regex.test(value)) {
    errors.push(`${key} is invalid`);
  }

  // Custom validation function
  if (customValidator && typeof customValidator === "function") {
    const customError = customValidator(value);
    if (customError) {
      errors.push(customError);
    }
  }

  // If no errors, add to validatedData
  if (!errors.length) {
    validatedData[key] = value;
  }
};
