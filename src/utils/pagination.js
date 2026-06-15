export const getPagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const buildPagination = (total, page, limit) => ({
  total,
  page,
  limit,
  pages: Math.ceil(total / limit) || 1,
});
