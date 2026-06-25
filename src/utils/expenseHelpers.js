export const formatExpense = (expense) => ({
  id: expense._id,
  hostelId: expense.hostel?._id ?? expense.hostel,
  hostelName: expense.hostel?.name ?? null,
  title: expense.title,
  details: expense.details || "",
  amount: expense.amount,
  image: expense.image || null,
  month: expense.month,
  year: expense.year,
  expenseDate: expense.expenseDate,
  createdAt: expense.createdAt,
});

export const parseExpensePeriod = (query) => {
  const now = new Date();
  const month =
    query.month !== undefined && query.month !== ""
      ? Number.parseInt(query.month, 10)
      : now.getMonth() + 1;
  const year =
    query.year !== undefined && query.year !== ""
      ? Number.parseInt(query.year, 10)
      : now.getFullYear();

  return { month, year };
};
