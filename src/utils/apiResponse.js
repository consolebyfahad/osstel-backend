export const success = (res, message, data = null, statusCode = 200) => {
  const response = { success: true, message };

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

export const error = (res, message, errors = null, statusCode = 400) => {
  const response = { success: false, message };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};
