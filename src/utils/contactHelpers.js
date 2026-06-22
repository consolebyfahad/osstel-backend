export const formatContactInquiry = (inquiry) => ({
  id: inquiry._id,
  name: inquiry.name,
  phone: inquiry.phone,
  email: inquiry.email,
  message: inquiry.message,
  source: inquiry.source,
  status: inquiry.status,
  createdAt: inquiry.createdAt,
});

export const formatAdminContactInquiry = (inquiry) => ({
  ...formatContactInquiry(inquiry),
  adminReply: inquiry.adminReply || null,
  repliedAt: inquiry.repliedAt || null,
  repliedBy: inquiry.repliedBy
    ? {
        id: inquiry.repliedBy._id,
        name: inquiry.repliedBy.name,
      }
    : null,
  updatedAt: inquiry.updatedAt,
});
