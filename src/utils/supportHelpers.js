export const formatSupportRequest = (request) => ({
  id: request._id,
  subject: request.subject,
  message: request.message,
  category: request.category,
  status: request.status,
  createdAt: request.createdAt,
  adminReply: request.adminReply || null,
  repliedAt: request.repliedAt || null,
});

export const formatAdminSupportRequest = (request) => ({
  ...formatSupportRequest(request),
  user: request.user
    ? {
        id: request.user._id,
        name: request.user.name,
        phone: request.user.phone,
        role: request.user.role,
      }
    : null,
  repliedBy: request.repliedBy
    ? {
        id: request.repliedBy._id,
        name: request.repliedBy.name,
      }
    : null,
});
